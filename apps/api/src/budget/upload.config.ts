import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { diskStorage, memoryStorage } from 'multer';
import type { Request } from 'express';

export const budgetUploadDir = path.resolve(process.env.IBRA_UPLOAD_DIR || path.join(process.cwd(), 'uploads'));

fs.mkdirSync(budgetUploadDir, { recursive: true });

const pdfFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  callback: (error: Error | null, accept: boolean) => void,
) => {
  const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
  callback(isPdf ? null : new Error('A PDF file is required'), isPdf);
};

const sanitizeFileName = (originalName: string) => originalName.replace(/[^a-zA-Z0-9_.-]/g, '_');

export const budgetDiskUploadOptions = {
  storage: diskStorage({
    destination: budgetUploadDir,
    filename: (_req: Request, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
      callback(null, `${randomUUID()}-${sanitizeFileName(file.originalname)}`);
    },
  }),
  fileFilter: pdfFileFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
};

export const budgetMemoryUploadOptions = {
  storage: memoryStorage(),
  fileFilter: pdfFileFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
};
