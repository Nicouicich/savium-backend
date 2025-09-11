import {Injectable} from '@nestjs/common';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
    photo?: Array<{file_id: string; file_size?: number}>;
    document?: {file_id: string; file_name: string};
  };
}

@Injectable()
export class TelegramService {
  // Note: This service structure is created but Telegram Bot API integration is not implemented

  async handleWebhook(update: TelegramUpdate): Promise<{processed: boolean; message: string}> {
    // Placeholder for webhook handling
    console.log('Telegram webhook received:', JSON.stringify(update, null, 2));

    if (update.message) {
      await this.processMessage(update.message);
    }

    return {
      processed: true,
      message: 'Webhook processed (mock implementation)'
    };
  }

  private async processMessage(message: any): Promise<void> {
    const chatId = message.chat.id;
    const text = message.text || '';

    // Handle commands
    if (text.startsWith('/')) {
      await this.handleCommand(chatId, text, message.from);
    } else if (message.photo) {
      await this.processReceiptPhoto(chatId, message.photo);
    } else if (message.document) {
      await this.processReceiptDocument(chatId, message.document);
    } else if (text) {
      await this.parseExpenseMessage(chatId, text);
    }
  }

  private async handleCommand(chatId: number, command: string, from: any): Promise<void> {
    const cmd = command.split(' ')[0].toLowerCase();

    switch (cmd) {
      case '/start':
        await this.sendWelcomeMessage(chatId, from.first_name);
        break;
      case '/help':
        await this.sendHelpMessage(chatId);
        break;
      case '/balance':
        await this.sendBalanceInfo(chatId);
        break;
      case '/categories':
        await this.sendCategoriesList(chatId);
        break;
      default:
        await this.sendMessage(chatId, '❓ Unknown command. Use /help to see available commands.');
    }
  }

  private async parseExpenseMessage(chatId: number, text: string): Promise<void> {
    // Parse expense from text like "25 lunch" or "spent 30 on groceries"
    const expenseData = this.extractExpenseData(text);

    if (expenseData.amount) {
      console.log('Parsed expense:', expenseData);
      await this.sendMessage(
        chatId,
        `✅ Expense recorded!\n💰 Amount: $${expenseData.amount}\n📝 Description: ${expenseData.description}\n\n(Mock confirmation - integration not implemented)`
      );
    } else {
      await this.sendMessage(chatId, '❌ Could not parse expense.\n\nTry formats like:\n• "25 lunch"\n• "spent 30 on groceries"\n• Or send a receipt photo');
    }
  }

  private extractExpenseData(text: string): {
    amount?: number;
    description?: string;
  } {
    // Basic expense parsing
    const patterns = [
      /(\d+(?:\.\d{2})?)\s+(.+)/, // "25 lunch"
      /spent\s+(\d+(?:\.\d{2})?)\s+on\s+(.+)/i, // "spent 25 on lunch"
      /\$?(\d+(?:\.\d{2})?)\s+for\s+(.+)/i // "$25 for lunch"
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          amount: parseFloat(match[1]),
          description: match[2].trim()
        };
      }
    }

    return {};
  }

  private async processReceiptPhoto(chatId: number, photos: any[]): Promise<void> {
    // Get the largest photo
    const photo = photos[photos.length - 1];
    console.log('Processing receipt photo:', photo.file_id);

    await this.sendMessage(chatId, '📸 Receipt photo received!\n\n🤖 Processing with AI...\n(Photo processing not implemented)');
  }

  private async processReceiptDocument(chatId: number, document: any): Promise<void> {
    console.log('Processing receipt document:', document.file_name);

    await this.sendMessage(chatId, '📄 Receipt document received!\n\n🤖 Processing...\n(Document processing not implemented)');
  }

  async sendMessage(chatId: number, text: string): Promise<void> {
    // Placeholder for sending Telegram messages
    console.log(`Sending Telegram message to ${chatId}: ${text}`);

    // In real implementation, use Telegram Bot API
    // await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ chat_id: chatId, text })
    // });
  }

  private async sendWelcomeMessage(chatId: number, firstName: string): Promise<void> {
    const message = `👋 Welcome to Savium AI, ${firstName}!\n\n🤖 I help you track expenses easily:\n\n• Send "25 lunch" to record $25 for lunch\n• Send receipt photos for auto-processing\n• Use /help for more commands\n\n(Telegram integration not implemented)`;
    await this.sendMessage(chatId, message);
  }

  private async sendHelpMessage(chatId: number): Promise<void> {
    const message = `🤖 Savium AI Bot Commands:\n\n💰 Expense Tracking:\n• "25 lunch" - Record $25 expense\n• "spent 30 on groceries" - Alternative format\n• Send receipt photos - Auto-extract expense\n\n📊 Information:\n• /balance - View current balance\n• /categories - List expense categories\n\n❓ Help:\n• /help - Show this message\n• /start - Welcome message\n\n(Bot features not implemented)`;
    await this.sendMessage(chatId, message);
  }

  private async sendBalanceInfo(chatId: number): Promise<void> {
    const message = [
      '💰 Account Balance',
      '',
      '📊 This Month:',
      '• Spent: $1,250 (mock data)',
      '• Budget: $2,000',
      '• Remaining: $750',
      '',
      '📈 Top Categories:',
      '• Food: $450',
      '• Transport: $200',
      '• Entertainment: $150',
      '',
      '(Balance data not implemented)'
    ].join('\n');
    await this.sendMessage(chatId, message);
  }

  private async sendCategoriesList(chatId: number): Promise<void> {
    const message = [
      '📂 Expense Categories:',
      '',
      '🍽️ Food & Dining',
      '🚗 Transportation',
      '🏠 Housing',
      '🎯 Entertainment',
      '🛒 Shopping',
      '💊 Healthcare',
      '📚 Education',
      '🔧 Utilities',
      '💼 Business',
      '📱 Subscriptions',
      '',
      '(Categories from mock data)'
    ].join('\n');
    await this.sendMessage(chatId, message);
  }

  async setWebhook(webhookUrl: string): Promise<{success: boolean; message: string}> {
    // Placeholder for setting webhook
    console.log('Setting Telegram webhook:', webhookUrl);

    // In real implementation:
    // const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ url: webhookUrl })
    // });

    return {
      success: true,
      message: 'Webhook set (mock implementation)'
    };
  }

  getServiceStatus(): {
    enabled: boolean;
    features: string[];
    limitations: string[];
  } {
    return {
      enabled: false,
      features: [
        'Webhook endpoint structure ready',
        'Command handling structure ready',
        'Expense parsing structure ready',
        'Receipt photo handling structure ready',
        'Bot commands structure ready'
      ],
      limitations: [
        'Telegram Bot API not integrated',
        'No actual message sending/receiving',
        'Returns mock responses only',
        'Requires Telegram Bot Token setup'
      ]
    };
  }
}
