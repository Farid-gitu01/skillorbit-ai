/**
 * security.middleware.ts — Application-level Security Controls
 *
 * Implements:
 *  1. HTTP Method Filtering (rejects TRACE, CONNECT, and unknown verbs with 405)
 *  2. NoSQL / MongoDB Operator Injection Sanitization (recursively strips $ operators and keys with .)
 *  3. CSRF Protection for state-changing requests (Origin/Referer and Sec-Fetch-Site validation)
 */
import { type RequestHandler } from 'express';
import { CLIENT_URL, IS_PRODUCTION } from '../config/constants.js';
import { sendError } from '../utils/api-response.util.js';

/**
 * Normalizes and returns the list of allowed trusted frontend origins.
 */
export const getAllowedOrigins = (): string[] => {
  const primary = CLIENT_URL.trim().replace(/\/$/, '');
  const origins = [primary];
  if (!IS_PRODUCTION) {
    origins.push('http://localhost:5173');
    origins.push('http://127.0.0.1:5173');
  }
  return [...new Set(origins)];
};

/**
 * Standard HTTP methods permitted by the SkillOrbit AI API.
 * Methods such as TRACE (Cross-Site Tracing) and CONNECT (proxy tunneling) are strictly disallowed.
 */
const ALLOWED_HTTP_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

export const methodFilter: RequestHandler = (req, res, next): void => {
  const method = req.method.toUpperCase();
  if (!ALLOWED_HTTP_METHODS.includes(method)) {
    res.setHeader('Allow', ALLOWED_HTTP_METHODS.join(', '));
    sendError(res, 405, `HTTP method ${req.method} is not allowed`, {
      code: 'METHOD_NOT_ALLOWED',
    });
    return;
  }
  next();
};

/**
 * Recursively inspects and cleans objects to remove keys starting with '$' or containing '.'
 * to prevent MongoDB query operator injection.
 */
const sanitizeObject = (target: unknown): void => {
  if (!target || typeof target !== 'object') return;
  if (Array.isArray(target)) {
    for (const item of target) sanitizeObject(item);
    return;
  }

  const obj = target as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else {
      sanitizeObject(obj[key]);
    }
  }
};

/**
 * MongoDB / NoSQL query injection protection middleware.
 * Sanitizes req.body, req.query, and req.params before route controllers or validators process them.
 */
export const sanitizeMongo: RequestHandler = (req, _res, next): void => {
  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);
  next();
};

/**
 * State-changing HTTP methods subject to CSRF defense.
 */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Extracts and normalizes the origin from a URL string (such as Referer).
 */
const extractOrigin = (urlStr: string | undefined): string | null => {
  if (!urlStr) return null;
  try {
    const parsed = new URL(urlStr);
    return parsed.origin;
  } catch {
    return null;
  }
};

/**
 * CSRF defense middleware for cookie-authenticated REST APIs.
 *
 * Implements OWASP-recommended Origin/Referer verification on state-changing requests:
 * 1. Safe methods (GET, HEAD, OPTIONS) pass through.
 * 2. If 'sec-fetch-site' is 'cross-site', reject immediately.
 * 3. If 'Origin' header is present, it MUST match an allowed trusted frontend origin.
 * 4. If 'Origin' is absent and 'Referer' is present, its origin MUST match an allowed trusted origin.
 * 5. If both Origin and Referer are absent from a browser, cross-origin requests cannot forge this.
 */
export const csrfProtection: RequestHandler = (req, res, next): void => {
  if (!MUTATING_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  // 1. Check Sec-Fetch-Site (modern browsers automatically send this; cannot be spoofed)
  const secFetchSite = req.headers['sec-fetch-site'];
  if (secFetchSite === 'cross-site') {
    sendError(res, 403, 'Cross-site request forgery blocked: cross-site request', {
      code: 'CSRF_INVALID_ORIGIN',
    });
    return;
  }

  const allowed = getAllowedOrigins();

  // 2. Validate Origin header
  const originHeader = req.get('origin');
  if (originHeader) {
    const normalizedOrigin = originHeader.trim().replace(/\/$/, '');
    if (!allowed.includes(normalizedOrigin)) {
      sendError(res, 403, 'Cross-site request forgery blocked: invalid origin', {
        code: 'CSRF_INVALID_ORIGIN',
      });
      return;
    }
    next();
    return;
  }

  // 3. Fallback to Referer header if Origin is absent
  const refererHeader = req.get('referer');
  if (refererHeader) {
    const refererOrigin = extractOrigin(refererHeader);
    if (!refererOrigin || !allowed.includes(refererOrigin)) {
      sendError(res, 403, 'Cross-site request forgery blocked: invalid referer', {
        code: 'CSRF_INVALID_ORIGIN',
      });
      return;
    }
  }

  // 4. Request without Origin or Referer (direct API client, automated test, or same-origin tool)
  next();
};
