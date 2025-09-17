export interface SendMessageRequest {
  userId: string;
  message: string;
  platform: 'telegram' | 'whatsapp' | 'both';
}

export interface ConnectUserRequest {
  userId: string;
  platform: 'telegram' | 'whatsapp';
  chatId?: string;
  phoneNumber?: string;
  additionalData?: {
    username?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
  };
}

export interface MessageResult {
  platform: string;
  success: boolean;
  chatId?: string;
  phoneNumber?: string;
  error?: string;
}
