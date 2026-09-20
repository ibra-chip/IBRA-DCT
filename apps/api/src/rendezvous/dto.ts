import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export class CreateRendezvousDto {
  @IsNotEmpty()
  @IsString()
  absenceDate!: string;

  @Matches(TIME_PATTERN, { message: 'time must be in HH:MM format' })
  time!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateRendezvousDto {
  @IsOptional()
  @IsString()
  absenceDate?: string;

  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'time must be in HH:MM format' })
  time?: string;
}
