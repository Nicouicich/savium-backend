import { applyDecorators, Type } from '@nestjs/common';
import { ApiResponse as SwaggerApiResponse, getSchemaPath } from '@nestjs/swagger';

export const ApiSuccessResponse = <TModel extends Type<any>>(
  model: TModel,
  description?: string,
  isArray = false,
) => {
  return applyDecorators(
    SwaggerApiResponse({
      status: 200,
      description: description || 'Success',
      schema: {
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          data: isArray
            ? {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              }
            : { $ref: getSchemaPath(model) },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-01T00:00:00.000Z',
          },
          path: {
            type: 'string',
            example: '/api/v1/users',
          },
        },
      },
    }),
  );
};

export const ApiPaginatedResponse = <TModel extends Type<any>>(
  model: TModel,
  description?: string,
) => {
  return applyDecorators(
    SwaggerApiResponse({
      status: 200,
      description: description || 'Success with pagination',
      schema: {
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(model) },
          },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'number', example: 1 },
              limit: { type: 'number', example: 10 },
              total: { type: 'number', example: 100 },
              totalPages: { type: 'number', example: 10 },
              hasNext: { type: 'boolean', example: true },
              hasPrevious: { type: 'boolean', example: false },
            },
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-01T00:00:00.000Z',
          },
          path: {
            type: 'string',
            example: '/api/v1/users',
          },
        },
      },
    }),
  );
};

export const ApiErrorResponse = (
  status: number,
  description: string,
  example?: any,
) => {
  return applyDecorators(
    SwaggerApiResponse({
      status,
      description,
      schema: {
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          error: {
            type: 'object',
            properties: {
              statusCode: { type: 'number', example: status },
              message: { type: 'string', example: description },
              details: { type: 'object', nullable: true },
              timestamp: {
                type: 'string',
                format: 'date-time',
                example: '2024-01-01T00:00:00.000Z',
              },
              path: { type: 'string', example: '/api/v1/users' },
              method: { type: 'string', example: 'GET' },
            },
          },
        },
        example: example || {
          success: false,
          error: {
            statusCode: status,
            message: description,
            timestamp: '2024-01-01T00:00:00.000Z',
            path: '/api/v1/users',
            method: 'GET',
          },
        },
      },
    }),
  );
};

// Generic decorator for single model responses
export const ApiResponseDecorator = <TModel extends Type<any>>(
  model: TModel | TModel[],
  status: number = 200,
  description?: string,
) => {
  const isArray = Array.isArray(model);
  const actualModel = isArray ? model[0] : model;
  
  return applyDecorators(
    SwaggerApiResponse({
      status,
      description: description || 'Success',
      schema: isArray ? {
        type: 'array',
        items: { $ref: getSchemaPath(actualModel) },
      } : { $ref: getSchemaPath(actualModel) },
    }),
  );
};

// Export for ApiResponseDto usage
export const ApiResponseDto = ApiResponseDecorator;