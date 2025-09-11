import {IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, Min} from 'class-validator';
import {Transform, Type} from 'class-transformer';
import {ApiPropertyOptional} from '@nestjs/swagger';

export enum ReportType {
  MONTHLY = 'monthly',
  CATEGORY = 'category',
  SUMMARY = 'summary',
  COMPARISON = 'comparison',
  TRENDS = 'trends'
}

export enum ReportPeriod {
  LAST_MONTH = 'last_month',
  LAST_3_MONTHS = 'last_3_months',
  LAST_6_MONTHS = 'last_6_months',
  LAST_YEAR = 'last_year',
  CUSTOM = 'custom'
}

export enum ExportFormat {
  PDF = 'pdf',
  CSV = 'csv',
  EXCEL = 'excel',
  JSON = 'json'
}

export class ReportQueryDto {
  @ApiPropertyOptional({
    description: 'Account ID to generate report for',
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional({
    description: 'Report type',
    enum: ReportType,
    example: ReportType.MONTHLY
  })
  @IsOptional()
  @IsEnum(ReportType)
  type?: ReportType;

  @ApiPropertyOptional({
    description: 'Report period',
    enum: ReportPeriod,
    example: ReportPeriod.LAST_MONTH
  })
  @IsOptional()
  @IsEnum(ReportPeriod)
  period?: ReportPeriod;

  @ApiPropertyOptional({
    description: 'Start date for custom period',
    example: '2024-01-01'
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for custom period',
    example: '2024-01-31'
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Category IDs to include in report',
    type: [String],
    example: ['507f1f77bcf86cd799439011']
  })
  @IsOptional()
  @Transform(({value}) => (Array.isArray(value) ? value : value.split(',')))
  categoryIds?: string[];

  @ApiPropertyOptional({
    description: 'Number of months for trends analysis',
    example: 12,
    minimum: 1,
    maximum: 24
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(24)
  months?: number;

  @ApiPropertyOptional({
    description: 'Currency for report',
    example: 'USD'
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Export format',
    enum: ExportFormat,
    example: ExportFormat.PDF
  })
  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat;

  @ApiPropertyOptional({
    description: 'Include comparison with previous period',
    example: true
  })
  @IsOptional()
  @Transform(({value}) => value === 'true' || value === true)
  includeComparison?: boolean;

  @ApiPropertyOptional({
    description: 'Group expenses by user (for shared accounts)',
    example: false
  })
  @IsOptional()
  @Transform(({value}) => value === 'true' || value === true)
  groupByUser?: boolean;
}
