import { Type } from 'class-transformer';
import { IsOptional, Max, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  sortBy?: string;

  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export class PaginationHelper {
  static createPaginationMeta(
    page: number,
    limit: number,
    total: number
  ): PaginationMeta {
    const totalPages = Math.ceil(total / limit);

    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1
    };
  }

  static getSkip(page: number, limit: number): number {
    return (page - 1) * limit;
  }

  static createPaginatedResult<T>(
    data: T[],
    page: number,
    limit: number,
    total: number
  ): PaginatedResult<T> {
    return {
      data,
      pagination: this.createPaginationMeta(page, limit, total)
    };
  }

  static createMongoosePaginationOptions(dto: PaginationDto) {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = dto;

    return {
      skip: this.getSkip(page, limit),
      limit,
      sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 }
    };
  }
}
