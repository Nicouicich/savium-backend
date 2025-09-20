/**
 * Log formatter utility to create single-color, readable log messages
 * Prevents the two-color issue where message and object appear in different colors
 */
export class LogFormatter {
  /**
   * Formats log data into a single readable string to avoid multi-color console output
   */
  static format(message: string, data?: any): string {
    if (!data) {
      return message;
    }

    // Convert object to inline string format instead of nested object
    const formattedData = this.stringifyLogData(data);
    return `${message} | ${formattedData}`;
  }

  /**
   * Converts log data to a clean, inline string format
   */
  private static stringifyLogData(data: any): string {
    if (data === null || data === undefined) {
      return 'null';
    }

    if (typeof data === 'string') {
      return data;
    }

    if (typeof data === 'number' || typeof data === 'boolean') {
      return String(data);
    }

    if (data instanceof Error) {
      return `Error: ${data.message}`;
    }

    if (data instanceof Date) {
      return data.toISOString();
    }

    if (Array.isArray(data)) {
      return `[${data.map(item => this.stringifyLogData(item)).join(', ')}]`;
    }

    if (typeof data === 'object') {
      try {
        const pairs: string[] = [];
        for (const [key, value] of Object.entries(data)) {
          // Skip undefined values
          if (value === undefined) continue;

          // Handle nested objects/arrays more compactly
          let formattedValue: string;
          if (value === null) {
            formattedValue = 'null';
          } else if (typeof value === 'object') {
            if (Array.isArray(value)) {
              formattedValue = `[${value.length} items]`;
            } else if (value instanceof Date) {
              formattedValue = value.toISOString();
            } else if (value instanceof Error) {
              formattedValue = `Error: ${value.message}`;
            } else {
              // For nested objects, show a summary instead of full expansion
              const keys = Object.keys(value);
              if (keys.length === 0) {
                formattedValue = '{}';
              } else if (keys.length <= 3) {
                formattedValue = JSON.stringify(value);
              } else {
                formattedValue = `{${keys.length} properties}`;
              }
            }
          } else {
            formattedValue = String(value);
          }

          pairs.push(`${key}: ${formattedValue}`);
        }
        return pairs.join(', ');
      } catch (error) {
        return '[Object - could not stringify]';
      }
    }

    return String(data);
  }

  /**
   * Creates a formatted log message for WhatsApp messages
   */
  static whatsappMessage(message: string, data: {
    from?: string;
    body?: string;
    timestamp?: Date | null;
    hasMedia?: boolean;
    mediaType?: string;
    traceId?: string;
  }): string {
    const parts = [message];

    if (data.from) parts.push(`from: ${data.from}`);
    if (data.body) parts.push(`body: "${data.body.substring(0, 50)}${data.body.length > 50 ? '...' : ''}"`);
    if (data.timestamp) parts.push(`time: ${data.timestamp.toISOString()}`);
    if (data.hasMedia !== undefined) parts.push(`hasMedia: ${data.hasMedia}`);
    if (data.mediaType) parts.push(`type: ${data.mediaType}`);
    if (data.traceId) parts.push(`trace: ${data.traceId}`);

    return parts.join(' | ');
  }

  /**
   * Creates a formatted log message for webhook events
   */
  static webhook(message: string, data: {
    hasPayload?: boolean;
    objectType?: string;
    entryCount?: number;
    traceId?: string;
    processed?: boolean;
    messagesProcessed?: number;
  }): string {
    const parts = [message];

    if (data.hasPayload !== undefined) parts.push(`hasPayload: ${data.hasPayload}`);
    if (data.objectType) parts.push(`type: ${data.objectType}`);
    if (data.entryCount !== undefined) parts.push(`entries: ${data.entryCount}`);
    if (data.messagesProcessed !== undefined) parts.push(`processed: ${data.messagesProcessed}`);
    if (data.processed !== undefined) parts.push(`success: ${data.processed}`);
    if (data.traceId) parts.push(`trace: ${data.traceId}`);

    return parts.join(' | ');
  }

  /**
   * Creates a formatted log message for user operations
   */
  static userOperation(message: string, data: {
    phoneNumber?: string;
    userId?: string;
    userName?: string;
    action?: string;
    success?: boolean;
    traceId?: string;
  }): string {
    const parts = [message];

    if (data.phoneNumber) parts.push(`phone: ${data.phoneNumber}`);
    if (data.userId) parts.push(`userId: ${data.userId}`);
    if (data.userName) parts.push(`user: ${data.userName}`);
    if (data.action) parts.push(`action: ${data.action}`);
    if (data.success !== undefined) parts.push(`success: ${data.success}`);
    if (data.traceId) parts.push(`trace: ${data.traceId}`);

    return parts.join(' | ');
  }

  /**
   * Creates a formatted log message for API operations
   */
  static apiOperation(message: string, data: {
    to?: string;
    messageLength?: number;
    url?: string;
    status?: number;
    error?: string;
    errorStatus?: number;
    traceId?: string;
  }): string {
    const parts = [message];

    if (data.to) parts.push(`to: ${data.to}`);
    if (data.messageLength !== undefined) parts.push(`length: ${data.messageLength}`);
    if (data.url) parts.push(`url: ${data.url}`);
    if (data.status !== undefined) parts.push(`status: ${data.status}`);
    if (data.errorStatus !== undefined) parts.push(`errorStatus: ${data.errorStatus}`);
    if (data.error) parts.push(`error: ${data.error.substring(0, 100)}${data.error.length > 100 ? '...' : ''}`);
    if (data.traceId) parts.push(`trace: ${data.traceId}`);

    return parts.join(' | ');
  }
}