import { IsNotEmpty, IsOptional } from 'class-validator';

export class CreateProjectDto {
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  location?: string;

  @IsOptional()
  status?: string;

  @IsOptional()
  managerId?: string;
}

export class UpdateProjectDto {
  @IsOptional()
  name?: string;

  @IsOptional()
  location?: string;

  @IsOptional()
  status?: string;

  @IsOptional()
  managerId?: string;
}
