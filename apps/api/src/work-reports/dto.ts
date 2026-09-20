import { Type } from 'class-transformer';
import { IsIn, IsLatitude, IsLongitude, IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

const QUANTITY_UNITS = ['m2', 'ml'] as const;
type QuantityUnit = (typeof QUANTITY_UNITS)[number];

export class EstimateQuantityDto {
  @IsIn(QUANTITY_UNITS)
  quantityUnit!: QuantityUnit;
}

export class CreateWorkReportDto {
  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsNotEmpty()
  @IsString()
  date!: string;

  @IsNotEmpty()
  @IsString()
  capturedAt!: string;

  @IsNotEmpty()
  @IsString()
  locationName!: string;

  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @IsIn(QUANTITY_UNITS)
  quantityUnit!: QuantityUnit;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  unitRate!: number;

  @IsIn(['ai', 'manual'])
  m2Source!: 'ai' | 'manual';
}

export class UpdateWorkReportStatusDto {
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';
}
