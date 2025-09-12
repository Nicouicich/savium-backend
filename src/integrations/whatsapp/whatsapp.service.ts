import { Injectable } from '@nestjs/common';

interface WhatsAppMessage {
  from: string;
  body: string;
  timestamp: Date;
  mediaUrl?: string;
  mediaType?: string;
}

interface WebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: any;
        contacts?: any[];
        messages?: any[];
        statuses?: any[];
      };
      field: string;
    }>;
  }>;
}

@Injectable()
export class WhatsappService {
  // Note: This service structure is created but WhatsApp API integration is not implemented
  // In a real implementation, you would integrate with WhatsApp Business API

  async handleWebhook(payload: WebhookPayload): Promise<{ processed: boolean; message: string }> {
    // Placeholder for webhook handling
    // In real implementation, this would:
    // 1. Verify webhook signature
    // 2. Parse incoming messages
    // 3. Process expense commands
    // 4. Handle media uploads (receipts)
    // 5. Send responses back to WhatsApp

    console.log('WhatsApp webhook received:', JSON.stringify(payload, null, 2));

    if (payload.entry?.[0]?.changes?.[0]?.value?.messages) {
      const { messages } = payload.entry[0].changes[0].value;

      for (const message of messages) {
        await this.processMessage({
          from: message.from,
          body: message.text?.body || '',
          timestamp: new Date(message.timestamp * 1000),
          mediaUrl: message.image?.id || message.document?.id,
          mediaType: message.type
        });
      }
    }

    return {
      processed: true,
      message: 'Webhook processed (mock implementation)'
    };
  }

  async processMessage(message: WhatsAppMessage): Promise<void> {
    // Placeholder for message processing
    // In real implementation, this would:
    // 1. Parse expense commands (e.g., "spent $25 on lunch")
    // 2. Extract amount, description, and category
    // 3. Create expense records
    // 4. Handle receipt images
    // 5. Send confirmation messages

    console.log('Processing WhatsApp message:', message);

    // Mock expense parsing
    if (message.body.toLowerCase().includes('spent') || message.body.toLowerCase().includes('expense')) {
      await this.parseExpenseMessage(message);
    } else if (message.mediaUrl) {
      await this.processReceiptImage(message);
    } else {
      await this.sendHelpMessage(message.from);
    }
  }

  private async parseExpenseMessage(message: WhatsAppMessage): Promise<void> {
    // Placeholder for expense parsing from text
    const expenseData = this.extractExpenseData(message.body);

    if (expenseData.amount) {
      console.log('Parsed expense:', expenseData);
      // In real implementation: save to database via ExpensesService
      await this.sendConfirmationMessage(message.from, expenseData);
    } else {
      await this.sendErrorMessage(message.from, 'Could not parse expense amount');
    }
  }

  private extractExpenseData(text: string): {
    amount?: number;
    description?: string;
    category?: string;
  } {
    // Basic expense parsing logic (placeholder)
    const amountMatch = text.match(/\$?(\d+(?:\.\d{2})?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : undefined;

    // Extract description (everything after "spent" or "expense")
    const descMatch = text.match(/(?:spent|expense).*?on\s+(.+)/i);
    const description = descMatch ? descMatch[1].trim() : text;

    return { amount, description };
  }

  private async processReceiptImage(message: WhatsAppMessage): Promise<void> {
    // Placeholder for receipt image processing
    console.log('Processing receipt image from:', message.from);

    // In real implementation:
    // 1. Download image from WhatsApp
    // 2. Process with AI service
    // 3. Create expense record
    // 4. Send confirmation

    await this.sendMessage(message.from, 'Receipt received! (Image processing not implemented)');
  }

  async sendMessage(to: string, message: string): Promise<void> {
    // Placeholder for sending WhatsApp messages
    console.log(`Sending WhatsApp message to ${to}: ${message}`);

    // In real implementation, this would use WhatsApp Business API
    // to send messages back to the user
  }

  private async sendConfirmationMessage(to: string, expenseData: any): Promise<void> {
    const message = `✅ Expense recorded!\nAmount: $${expenseData.amount}\nDescription: ${expenseData.description || 'N/A'}\n\n(Mock confirmation - integration not implemented)`;
    await this.sendMessage(to, message);
  }

  private async sendErrorMessage(to: string, error: string): Promise<void> {
    const message = `❌ Error: ${error}\n\nPlease try again with format: "spent $25 on lunch"`;
    await this.sendMessage(to, message);
  }

  private async sendHelpMessage(to: string): Promise<void> {
    const helpText = [
      '🤖 Savium AI - Expense Tracking',
      '',
      'Commands:',
      '• "spent $25 on lunch" - Record expense',
      '• Send receipt photo - Auto-extract expense',
      '• "help" - Show this message',
      '',
      '(WhatsApp integration not implemented)'
    ].join('\n');
    await this.sendMessage(to, helpText);
  }

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    // Placeholder for webhook verification
    // In real implementation, verify the token matches your configured verify token

    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'your-verify-token';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WhatsApp webhook verified');
      return challenge;
    }

    console.log('WhatsApp webhook verification failed');
    return null;
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
        'Message parsing structure ready',
        'Receipt image handling structure ready',
        'Expense command processing structure ready'
      ],
      limitations: [
        'WhatsApp Business API not integrated',
        'No actual message sending/receiving',
        'Returns mock responses only',
        'Requires WhatsApp Business API setup'
      ]
    };
  }
}
