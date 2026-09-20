import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { diskStorage, memoryStorage } from 'multer';
import type { Request } from 'express';

export const uploadDir = path.resolve(process.env.IBRA_UPLOAD_DIR || path.join(process.cwd(), 'uploads'));

fs.mkdirSync(uploadDir, { recursive: true });

const sanitizeFileName = (originalName: string) => originalName.replace(/[^a-zA-Z0-9_.-]/g, '_');

type FileFilterCallback = (error: Error | null, accept: boolean) => void;

const pdfFileFilter = (_req: Request, file: Express.Multer.File, callback: FileFilterCallback) => {
  const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
  callback(isPdf ? null : new Error('A PDF file is required'), isPdf);
};

const imageFileFilter = (_req: Request, file: Express.Multer.File, callback: FileFilterCallback) => {
  const isImage = file.mimetype.startsWith('image/');
  callback(isImage ? null : new Error('An image file is required'), isImage);
};

const diskUploadOptions = (fileFilter: typeof pdfFileFilter) => ({
  storage: diskStorage({
    destination: uploadDir,
    filename: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
      callback(null, `${randomUUID()}-${sanitizeFileName(file.originalname)}`);
    },
  }),
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
});

const memoryUploadOptions = (fileFilter: typeof pdfFileFilter) => ({
  storage: memoryStorage(),
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
});

export const pdfDiskUploadOptions = diskUploadOptions(pdfFileFilter);
export const pdfMemoryUploadOptions = memoryUploadOptions(pdfFileFilter);
export const imageDiskUploadOptions = diskUploadOptions(imageFileFilter);
export const imageMemoryUploadOptions = memoryUploadOptions(imageFileFilter);
