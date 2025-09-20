import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';

/**
 * ParseObjectIdPipe - Validates and transforms string values to MongoDB ObjectIds
 *
 * This pipe validates that a string parameter is a valid MongoDB ObjectId format
 * before it reaches the service layer, preventing MongoDB casting errors.
 *
 * @example
 * ```typescript
 * @Get(':id')
 * async findOne(@Param('id', ParseObjectIdPipe) id: string) {
 *   // id is guaranteed to be a valid ObjectId format
 * }
 *
 * @Get('summary')
 * async getSummary(@Query('accountId', ParseObjectIdPipe) accountId: string) {
 *   // accountId is guaranteed to be a valid ObjectId format
 * }
 * ```
 */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  /**
   * Transforms and validates the input value as a MongoDB ObjectId
   *
   * @param value - The input value to validate (typically from @Param or @Query)
   * @param metadata - NestJS argument metadata (contains parameter info)
   * @returns The validated ObjectId string
   * @throws BadRequestException if the value is not a valid ObjectId
   */
  transform(value: string, metadata: ArgumentMetadata): string {
    // Handle undefined/null values
    if (value === undefined || value === null) {
      throw new BadRequestException(
        `${metadata.data || 'Parameter'} is required and must be a valid MongoDB ObjectId`
      );
    }

    // Handle empty strings
    if (typeof value === 'string' && value.trim() === '') {
      throw new BadRequestException(
        `${metadata.data || 'Parameter'} cannot be empty and must be a valid MongoDB ObjectId`
      );
    }

    // Validate ObjectId format using MongoDB's native validation
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(
        `${metadata.data || 'Parameter'} must be a valid MongoDB ObjectId (24-character hexadecimal string). `
          + `Received: "${value}". Expected format: "507f1f77bcf86cd799439011"`
      );
    }

    // Additional validation: ensure it's actually a 24-character hex string
    // This catches edge cases where isValid might pass but it's not the right format
    if (typeof value !== 'string' || !/^[0-9a-fA-F]{24}$/.test(value)) {
      throw new BadRequestException(
        `${metadata.data || 'Parameter'} must be a 24-character hexadecimal string. `
          + `Received: "${value}". Expected format: "507f1f77bcf86cd799439011"`
      );
    }

    return value;
  }
}

/**
 * ParseOptionalObjectIdPipe - Similar to ParseObjectIdPipe but allows undefined values
 *
 * This pipe is useful for optional query parameters that should be valid ObjectIds when provided
 *
 * @example
 * ```typescript
 * @Get()
 * async findAll(@Query('accountId', ParseOptionalObjectIdPipe) accountId?: string) {
 *   // accountId is either undefined or a valid ObjectId format
 * }
 * ```
 */
@Injectable()
export class ParseOptionalObjectIdPipe implements PipeTransform<string | undefined, string | undefined> {
  transform(value: string | undefined, metadata: ArgumentMetadata): string | undefined {
    // Allow undefined values for optional parameters
    if (value === undefined || value === null) {
      return undefined;
    }

    // For provided values, use the same validation as ParseObjectIdPipe
    const parseObjectIdPipe = new ParseObjectIdPipe();
    return parseObjectIdPipe.transform(value, metadata);
  }
}
