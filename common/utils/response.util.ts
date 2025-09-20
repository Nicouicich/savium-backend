export class ResponseUtil {
  static success<T>(data: T, message?: string) {
    return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString()
    };
  }

  static successWithPagination<T>(
    data: T[],
    pagination: any,
    message?: string
  ) {
    return {
      success: true,
      data,
      pagination,
      message,
      timestamp: new Date().toISOString()
    };
  }

  static error(message: string, statusCode: number, details?: any) {
    return {
      success: false,
      error: {
        statusCode,
        message,
        details,
        timestamp: new Date().toISOString()
      }
    };
  }

  static created<T>(data: T, message = 'Resource created successfully') {
    return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString()
    };
  }

  static updated<T>(data: T, message = 'Resource updated successfully') {
    return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString()
    };
  }

  static deleted(message = 'Resource deleted successfully') {
    return {
      success: true,
      message,
      timestamp: new Date().toISOString()
    };
  }
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  timestamp: string;
  error?: {
    statusCode: number;
    message: string;
    details?: any;
    timestamp: string;
  };
}
