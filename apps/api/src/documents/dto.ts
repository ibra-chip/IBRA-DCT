import { IsNotEmpty, IsOptional } from 'class-validator';

export class CreateDocumentDto {
  @IsNotEmpty()
  title!: string;

  @IsNotEmpty()
  fileName!: string;

  @IsNotEmpty()
  storageKey!: string;

  @IsNotEmpty()
  mimeType!: string;

  @IsOptional()
  category?: string;

  @IsOptional()
  uploadedBy?: string;
}
