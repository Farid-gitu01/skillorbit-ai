// Auth controller: registration, login, logout, and password reset
import { type Request, type Response, type NextFunction } from 'express';
import { User } from '../models/user.model.js';
import { generateToken } from '../utils/token.util.js';
import {
  AUTH_COOKIE_NAME,
  getAuthCookieClearOptions,
  getAuthCookieOptions,
} from '../utils/auth-cookie.util.js';
import { IS_EXPLICIT_DEVELOPMENT } from '../config/constants.js';
import {
  EMAIL_VERIFICATION_TOKEN_TTL_MS,
  generatePasswordResetToken,
  hashPasswordResetToken,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from '../utils/password-reset.util.js';
import {
  type EmailVerificationInput,
  type LoginInput,
  type PasswordResetInput,
  type PasswordResetRequestInput,
  type RegisterInput,
  type ResendVerificationInput,
} from '../validators/auth.validator.js';
import { emailService } from '../services/email/email.service.js';

const safeUser = (user: InstanceType<typeof User>) => ({
  _id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { fullName, email, password, role } = req.body as RegisterInput;

    if (await User.exists({ email })) {
      res.status(409).json({ success: false, message: 'Email already in use' });
      return;
    }

    // Explicit field mapping prevents mass assignment; save() runs the model's bcrypt hook.
    const verificationToken = generatePasswordResetToken();
    const user = await User.create({
      name: fullName,
      email,
      password,
      role,
      isEmailVerified: false,
      emailVerificationTokenHash: hashPasswordResetToken(verificationToken),
      emailVerificationExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS),
    });

    let verificationEmailSent = false;
    if (emailService.isConfigured()) {
      try {
        await emailService.sendVerificationEmail(email, verificationToken);
        verificationEmailSent = true;
      } catch {
        console.warn('[email] Verification delivery failed; sensitive details omitted.');
      }
    }

    const token = generateToken(user.id);

    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions(token));

    res.status(201).json({
      success: true,
      data: { user: safeUser(user) },
      message: verificationEmailSent
				? 'Registration successful. Check your email to verify your account.'
        : 'Registration successful. Verification email delivery is unavailable; request another verification email when delivery is configured.',
    ...(IS_EXPLICIT_DEVELOPMENT && !emailService.isConfigured()
      ? { data: { user: safeUser(user), verificationToken } }
      : {}),
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      res.status(409).json({ success: false, message: 'Email already in use' });
      return;
    }

    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body as LoginInput;
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.matchPassword(password))) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    if (user.isActive !== true || user.isDeleted === true || user.deletedAt != null) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user.id);
    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions(token));

    res.status(200).json({
      success: true,
      data: {
        user: {
          ...safeUser(user),
        },
      },
      message: 'Login successful',
    });
  } catch (error) {
    next(error);
  }
};

export const logout = (_req: Request, res: Response): void => {
  res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieClearOptions());
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

export const requestPasswordReset = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body as PasswordResetRequestInput;
    const resetToken = generatePasswordResetToken();
    const resetTokenHash = hashPasswordResetToken(resetToken);

    const user = await User.findOneAndUpdate(
      { email, isActive: true, isDeleted: false, deletedAt: null },
      {
        $set: {
          passwordResetTokenHash: resetTokenHash,
          passwordResetExpiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
        },
      },
      { new: true }
    );

    if (user && emailService.isConfigured()) {
      void emailService.sendPasswordResetEmail(user.email, resetToken).catch(() => {
        console.warn('[email] Password-reset delivery failed; sensitive details omitted.');
      });
    }

    const response: {
      success: true;
      message: string;
      data?: { resetToken: string };
    } = {
      success: true,
      message: 'If an account exists, reset instructions can be sent.',
    };

    // Development-only delivery aid; returned for all requests to keep response shape non-enumerating.
    if (IS_EXPLICIT_DEVELOPMENT && !emailService.isConfigured()) {
      response.data = { resetToken };
    }

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.body as EmailVerificationInput;
    const user = await User.findOneAndUpdate(
      {
        emailVerificationTokenHash: hashPasswordResetToken(token),
        emailVerificationExpiresAt: { $gt: new Date() },
        isEmailVerified: false,
        isActive: true,
        isDeleted: false,
        deletedAt: null,
      },
      {
        $set: { isEmailVerified: true },
        $unset: {
          emailVerificationTokenHash: 1,
          emailVerificationExpiresAt: 1,
        },
      },
      { new: true }
    );

    if (!user) {
      res.status(400).json({ success: false, message: 'Invalid or expired verification token' });
      return;
    }

    res.status(200).json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  }
};

export const resendVerificationEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body as ResendVerificationInput;
    const verificationToken = generatePasswordResetToken();
    const user = await User.findOneAndUpdate(
      { email, isEmailVerified: false, isActive: true, isDeleted: false, deletedAt: null },
      {
        $set: {
          emailVerificationTokenHash: hashPasswordResetToken(verificationToken),
          emailVerificationExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS),
        },
      },
      { new: true }
    );

    if (user && emailService.isConfigured()) {
      void emailService.sendVerificationEmail(user.email, verificationToken).catch(() => {
        console.warn('[email] Verification delivery failed; sensitive details omitted.');
      });
    }

    const response: { success: true; message: string; data?: { verificationToken: string } } = {
      success: true,
      message: 'If the account requires verification, instructions can be sent.',
    };
    if (IS_EXPLICIT_DEVELOPMENT && !emailService.isConfigured()) {
      response.data = { verificationToken };
    }
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token, newPassword } = req.body as PasswordResetInput;
    const user = await User.findOneAndUpdate(
      {
        passwordResetTokenHash: hashPasswordResetToken(token),
        passwordResetExpiresAt: { $gt: new Date() },
        isActive: true,
        isDeleted: false,
        deletedAt: null,
      },
      {
        $unset: {
          passwordResetTokenHash: 1,
          passwordResetExpiresAt: 1,
        },
      },
      { new: true }
    );

    if (!user) {
      res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
      return;
    }

    // Assign plaintext once; the existing pre-save hook performs the only bcrypt hash.
    user.password = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: 'Password has been reset successfully' });
  } catch (error) {
    next(error);
  }
};
