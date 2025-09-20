import { IsOptional, IsString, IsEnum, IsDate, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum ExportFormat {
  PDF = 'pdf',
  CSV = 'csv',
  EXCEL = 'excel'
}

export enum ExportPeriod {
  CURRENT_MONTH = 'current_month',
  LAST_MONTH = 'last_month',
  LAST_3_MONTHS = 'last_3_months',
  LAST_6_MONTHS = 'last_6_months',
  CURRENT_YEAR = 'current_year',
  CUSTOM = 'custom'
}

export class TransactionExportDto {
  @ApiPropertyOptional({ description: 'Profile ID to export transactions from', example: '507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsString()
  profileId?: string;

  @ApiPropertyOptional({ description: 'Export format', enum: ExportFormat, default: ExportFormat.PDF })
  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat = ExportFormat.PDF;

  @ApiPropertyOptional({ description: 'Export period', enum: ExportPeriod, default: ExportPeriod.CURRENT_MONTH })
  @IsOptional()
  @IsEnum(ExportPeriod)
  period?: ExportPeriod = ExportPeriod.CURRENT_MONTH;

  @ApiPropertyOptional({ description: 'Start date for custom period', example: '2024-01-01' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional({ description: 'End date for custom period', example: '2024-12-31' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional({ description: 'Category ID to filter transactions', example: '507f1f77bcf86cd799439012' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Include summary statistics', default: true })
  @IsOptional()
  @IsBoolean()
  includeSummary?: boolean = true;

  @ApiPropertyOptional({ description: 'Include category breakdown', default: true })
  @IsOptional()
  @IsBoolean()
  includeCategoryBreakdown?: boolean = true;

  @ApiPropertyOptional({ description: 'Include monthly trends', default: false })
  @IsOptional()
  @IsBoolean()
  includeMonthlyTrends?: boolean = false;

  @ApiPropertyOptional({ description: 'Group by category', default: false })
  @IsOptional()
  @IsBoolean()
  groupByCategory?: boolean = false;

  @ApiPropertyOptional({ description: 'Include private transactions', default: true })
  @IsOptional()
  @IsBoolean()
  includePrivate?: boolean = true;
}
