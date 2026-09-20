import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
  @IsString()
  evidenceType?: string;

  @IsOptional()
  @IsString()
  phase?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
