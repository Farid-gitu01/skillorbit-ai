import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { type Request } from 'express';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'resumes');

// Private upload directory — never mounted via express.static
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (
    _req: Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const sanitizedBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50);
    cb(null, `${sanitizedBase || 'resume'}-${uniqueSuffix}${ext}`);
  },
});

export const EXTENSION_TO_MIME: Readonly<Record<string, string>> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const expectedMime = EXTENSION_TO_MIME[ext];

  if (expectedMime && file.mimetype === expectedMime) {
    cb(null, true);
    return;
  }

  cb(new Error('Invalid file type. Only valid PDF (.pdf) and DOCX (.docx) files are permitted.'));
};

export const MAX_RESUME_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export const resumeUpload = multer({
  storage,
  limits: {
    fileSize: MAX_RESUME_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter,
});
