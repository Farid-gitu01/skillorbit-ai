import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { ApplicationError } from '../../../utils/application-error.js';

export const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_EXTRACTED_TEXT_CHARS = 24_000;
export const MIN_EXTRACTED_TEXT_CHARS = 30;
const MAX_DECOMPRESSED_ENTRY_BYTES = 2 * 1024 * 1024; // 2MB zip/stream bomb guard
const MAX_ZIP_ENTRIES = 150;

export interface ExtractedResumeText {
  text: string;
  charCount: number;
  truncated: boolean;
  contentHash: string;
  fileType: 'pdf' | 'docx';
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_m, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
    });
}

function normalizeExtractedText(raw: string): {
  text: string;
  truncated: boolean;
} {
  const cleaned = raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleaned.length > MAX_EXTRACTED_TEXT_CHARS) {
    return {
      text: cleaned.slice(0, MAX_EXTRACTED_TEXT_CHARS),
      truncated: true,
    };
  }
  return { text: cleaned, truncated: false };
}

function decodePdfLiteralString(segment: string): string {
  let out = '';
  for (let i = 0; i < segment.length; i += 1) {
    const ch = segment[i];
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    i += 1;
    if (i >= segment.length) break;
    const esc = segment[i];
    if (esc === 'n') out += '\n';
    else if (esc === 'r') out += '\n';
    else if (esc === 't') out += ' ';
    else if (esc === 'b' || esc === 'f') continue;
    else if (esc === '(' || esc === ')' || esc === '\\') out += esc;
    else if (esc >= '0' && esc <= '7') {
      const oct = segment.slice(i, i + 3).match(/^[0-7]{1,3}/)?.[0] ?? esc;
      i += oct.length - 1;
      const code = Number.parseInt(oct, 8);
      if (code >= 32 && code <= 126) out += String.fromCharCode(code);
    } else if (esc === '\r' || esc === '\n') {
      continue;
    } else {
      out += esc;
    }
  }
  return out;
}

function extractTextTokensFromPdfContentStream(content: string): string[] {
  const parts: string[] = [];
  let inParens = false;
  let parenDepth = 0;
  let escaped = false;
  let current = '';

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i]!;
    if (!inParens) {
      if (ch === '(') {
        inParens = true;
        parenDepth = 1;
        current = '';
      }
      continue;
    }

    if (escaped) {
      current += `\\${ch}`;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '(') {
      parenDepth += 1;
      current += ch;
      continue;
    }
    if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        inParens = false;
        const decoded = decodePdfLiteralString(current).trim();
        if (decoded) parts.push(decoded);
        current = '';
      } else {
        current += ch;
      }
      continue;
    }
    current += ch;
  }

  return parts;
}

function extractTextFromPdfBuffer(buffer: Buffer): string {
  // Verify %PDF- header within first 1024 bytes
  const headerSlice = buffer.subarray(0, Math.min(1024, buffer.length)).toString('latin1');
  if (!headerSlice.includes('%PDF-')) {
    throw new ApplicationError('Uploaded file does not have a valid PDF signature.', {
      statusCode: 400,
      code: 'INVALID_RESUME_FILE',
    });
  }

  const latin1 = buffer.toString('latin1');
  if (/\/Encrypt\b/.test(latin1)) {
    throw new ApplicationError('Encrypted or password-protected PDF files are not supported.', {
      statusCode: 400,
      code: 'UNSUPPORTED_ENCRYPTED_RESUME',
    });
  }

  if (/\/(?:JavaScript|JS|Launch)\b/.test(latin1)) {
    throw new ApplicationError('PDF files with active script or launch actions are rejected for security.', {
      statusCode: 400,
      code: 'UNSAFE_RESUME_FILE',
    });
  }

  const collectedFragments: string[] = [];
  const streamRegex = /<<([\s\S]*?)>>\s*stream\r?\n/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(latin1)) !== null) {
    const dict = match[1] ?? '';
    const streamStart = match.index + match[0].length;
    const endIdx = latin1.indexOf('endstream', streamStart);
    if (endIdx === -1) break;

    let streamEnd = endIdx;
    if (latin1[streamEnd - 1] === '\n') streamEnd -= 1;
    if (latin1[streamEnd - 1] === '\r') streamEnd -= 1;
    if (streamEnd <= streamStart) continue;

    const rawStream = buffer.subarray(streamStart, streamEnd);
    if (rawStream.length > MAX_RESUME_BYTES) continue;

    let contentText = '';
    if (/\/FlateDecode\b/.test(dict)) {
      try {
        const inflated = zlib.inflateSync(rawStream, {
          maxOutputLength: MAX_DECOMPRESSED_ENTRY_BYTES,
        });
        contentText = inflated.toString('latin1');
      } catch {
        continue;
      }
    } else if (!/\/Filter\b/.test(dict)) {
      contentText = rawStream.toString('latin1');
    } else {
      continue;
    }

    if (/\b(?:BT|Tj|TJ)\b/.test(contentText) || contentText.includes('(')) {
      collectedFragments.push(...extractTextTokensFromPdfContentStream(contentText));
    }
  }

  // Fallback for plain text-only minimal PDFs without << >> dict wrapping
  if (collectedFragments.length === 0) {
    collectedFragments.push(...extractTextTokensFromPdfContentStream(latin1));
  }

  return collectedFragments.join(' ');
}

function findZipEndOfCentralDirectory(buffer: Buffer): number {
  const minOffset = Math.max(0, buffer.length - 65_557);
  for (let i = buffer.length - 22; i >= minOffset; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      return i;
    }
  }
  return -1;
}

function extractTextFromDocxBuffer(buffer: Buffer): string {
  // ZIP local file header magic: PK\x03\x04
  if (buffer.length < 30 || buffer.readUInt32LE(0) !== 0x04034b50) {
    throw new ApplicationError('Uploaded file is not a valid DOCX archive.', {
      statusCode: 400,
      code: 'INVALID_RESUME_FILE',
    });
  }

  const eocdOffset = findZipEndOfCentralDirectory(buffer);
  if (eocdOffset === -1) {
    throw new ApplicationError('DOCX archive directory is corrupted.', {
      statusCode: 400,
      code: 'INVALID_RESUME_FILE',
    });
  }

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (entryCount > MAX_ZIP_ENTRIES || centralDirOffset >= buffer.length) {
    throw new ApplicationError('DOCX archive exceeds structural safety limits.', {
      statusCode: 400,
      code: 'UNSAFE_RESUME_FILE',
    });
  }

  let cursor = centralDirOffset;
  let totalDecompressedBytes = 0;
  let documentXmlText = '';
  const extraXmlParts: string[] = [];

  for (let i = 0; i < entryCount; i += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new ApplicationError('Corrupted DOCX entry table.', {
        statusCode: 400,
        code: 'INVALID_RESUME_FILE',
      });
    }

    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const fileNameLen = buffer.readUInt16LE(cursor + 28);
    const extraLen = buffer.readUInt16LE(cursor + 30);
    const commentLen = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);

    const fileNameStart = cursor + 46;
    const entryName = buffer.subarray(fileNameStart, fileNameStart + fileNameLen).toString('utf8');
    cursor = fileNameStart + fileNameLen + extraLen + commentLen;

    if (entryName.includes('..') || path.isAbsolute(entryName)) {
      throw new ApplicationError('Unsafe archive path detected in DOCX resume.', {
        statusCode: 400,
        code: 'UNSAFE_RESUME_FILE',
      });
    }

    if (/vbaProject\.bin$/i.test(entryName)) {
      throw new ApplicationError('Macro-enabled Word documents are not permitted.', {
        statusCode: 400,
        code: 'UNSAFE_RESUME_FILE',
      });
    }

    const isPrimaryDoc = entryName === 'word/document.xml';
    const isHeaderOrFooter = /^word\/(?:header|footer)\d*\.xml$/i.test(entryName);
    if (!isPrimaryDoc && !isHeaderOrFooter) {
      continue;
    }

    if (
      uncompressedSize > MAX_DECOMPRESSED_ENTRY_BYTES ||
      totalDecompressedBytes + uncompressedSize > MAX_RESUME_BYTES
    ) {
      throw new ApplicationError('DOCX XML content exceeds safety size limits.', {
        statusCode: 400,
        code: 'UNSAFE_RESUME_FILE',
      });
    }

    if (
      localHeaderOffset + 30 > buffer.length ||
      buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50
    ) {
      throw new ApplicationError('Corrupted DOCX local file entry.', {
        statusCode: 400,
        code: 'INVALID_RESUME_FILE',
      });
    }

    const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;

    if (dataEnd > buffer.length || dataStart > dataEnd) {
      throw new ApplicationError('Corrupted DOCX compressed payload.', {
        statusCode: 400,
        code: 'INVALID_RESUME_FILE',
      });
    }

    const compressedData = buffer.subarray(dataStart, dataEnd);
    let xmlContent = '';

    if (compressionMethod === 0) {
      xmlContent = compressedData.toString('utf8');
    } else if (compressionMethod === 8) {
      try {
        const inflated = zlib.inflateRawSync(compressedData, {
          maxOutputLength: MAX_DECOMPRESSED_ENTRY_BYTES,
        });
        totalDecompressedBytes += inflated.length;
        xmlContent = inflated.toString('utf8');
      } catch {
        throw new ApplicationError('Unable to decompress DOCX resume XML.', {
          statusCode: 400,
          code: 'INVALID_RESUME_FILE',
        });
      }
    } else {
      throw new ApplicationError('Unsupported DOCX compression method.', {
        statusCode: 400,
        code: 'INVALID_RESUME_FILE',
      });
    }

    if (isPrimaryDoc) {
      documentXmlText = xmlContent;
    } else {
      extraXmlParts.push(xmlContent);
    }
  }

  if (!documentXmlText) {
    throw new ApplicationError('DOCX file does not contain document content (word/document.xml).', {
      statusCode: 400,
      code: 'INVALID_RESUME_FILE',
    });
  }

  const combinedXml = [documentXmlText, ...extraXmlParts].join('\n');
  const textWithBreaks = combinedXml
    .replace(/<w:(?:br|cr)\b[^>]*\/?>/gi, '\n')
    .replace(/<w:tab\b[^>]*\/?>/gi, ' ')
    .replace(/<\/w:(?:p|tr)>/gi, '\n')
    .replace(/<\/w:tc>/gi, ' | ')
    .replace(/<[^>]+>/g, '');

  return decodeXmlEntities(textWithBreaks);
}

/**
 * Validates resume file content by extension, MIME type, magic bytes, and size limits,
 * then extracts normalized UTF-8 text securely on the backend.
 */
export function extractResumeTextFromBuffer(options: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}): ExtractedResumeText {
  const { buffer, fileName, mimeType } = options;

  if (!buffer || buffer.length === 0) {
    throw new ApplicationError('Resume file is empty.', {
      statusCode: 400,
      code: 'EMPTY_RESUME_FILE',
    });
  }

  if (buffer.length > MAX_RESUME_BYTES) {
    throw new ApplicationError('Resume file exceeds the 5MB maximum size limit.', {
      statusCode: 400,
      code: 'FILE_TOO_LARGE',
    });
  }

  const ext = path.extname(fileName).toLowerCase();
  const isPdf = ext === '.pdf' && mimeType === 'application/pdf';
  const isDocx =
    ext === '.docx' &&
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (!isPdf && !isDocx) {
    throw new ApplicationError('Unsupported resume format. Only valid PDF and DOCX files are accepted.', {
      statusCode: 400,
      code: 'UNSUPPORTED_RESUME_TYPE',
    });
  }

  const rawExtracted = isPdf
    ? extractTextFromPdfBuffer(buffer)
    : extractTextFromDocxBuffer(buffer);

  const { text, truncated } = normalizeExtractedText(rawExtracted);
  if (text.length < MIN_EXTRACTED_TEXT_CHARS) {
    throw new ApplicationError(
      'Unable to extract readable text from this resume. Please upload a text-based PDF or DOCX document.',
      {
        statusCode: 400,
        code: 'RESUME_UNREADABLE',
      }
    );
  }

  const contentHash = createHash('sha256').update(text, 'utf8').digest('hex');

  return {
    text,
    charCount: text.length,
    truncated,
    contentHash,
    fileType: isPdf ? 'pdf' : 'docx',
  };
}

export async function extractResumeTextFromDisk(options: {
  storedFileName: string;
  originalFileName: string;
  mimeType: string;
}): Promise<ExtractedResumeText> {
  const safeBaseName = path.basename(options.storedFileName);
  const uploadRoot = path.resolve(process.cwd(), 'uploads', 'resumes');
  const resolvedPath = path.resolve(uploadRoot, safeBaseName);

  if (!resolvedPath.startsWith(uploadRoot)) {
    throw new ApplicationError('Invalid resume storage path.', {
      statusCode: 400,
      code: 'INVALID_RESUME_PATH',
    });
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = await fs.readFile(resolvedPath);
  } catch {
    throw new ApplicationError('Stored resume file could not be read on the server.', {
      statusCode: 404,
      code: 'FILE_NOT_FOUND',
    });
  }

  return extractResumeTextFromBuffer({
    buffer: fileBuffer,
    fileName: options.originalFileName,
    mimeType: options.mimeType,
  });
}
