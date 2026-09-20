import { IsArray, IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';

export class ChecklistItemDto {
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  description?: string;

  @IsOptional()
  assignedTo?: string;

  @IsOptional()
  dueDate?: string;
}

export class CreateChecklistDto {
  @IsNotEmpty()
  type!: string;

  @IsNotEmpty()
  title!: string;

  @IsOptional()
  createdBy?: string;

  @IsArray()
  @ValidateNested({ each: true })
  items!: ChecklistItemDto[];
}
