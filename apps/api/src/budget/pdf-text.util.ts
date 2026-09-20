import { PDFParse } from 'pdf-parse';

export const parsePdfText = async (buffer: Buffer): Promise<string> => {
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text.replace(/\s+/g, ' ').trim();
  } catch (error) {
    console.error('PDF text parse failed:', (error as Error).message);
    return '';
  }
};
