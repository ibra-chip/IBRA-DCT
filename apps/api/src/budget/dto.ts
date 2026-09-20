import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateBudgetDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  total!: number;

  @IsOptional()
  @IsString()
  chantierName?: string;

  @IsOptional()
  @IsString()
  devisNumber?: string;

  @IsOptional()
  @IsString()
  client?: string;

  @IsOptional()
  @IsString()
  replaceExisting?: string;
}

const PURCHASE_CATEGORIES = ['material', 'tools', 'machines', 'workers', 'subcontracting', 'other'] as const;

export class CreatePurchaseDto {
  @IsIn(PURCHASE_CATEGORIES)
  category!: (typeof PURCHASE_CATEGORIES)[number];

  @IsNotEmpty()
  @IsString()
  supplier!: string;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  purchaseDate?: string;
}
