import { RequestContextService } from '@common/interceptors/request-context';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export interface MailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  context?: Record<string, any>;
}

export interface WelcomeEmailContext {
  firstName: string;
  email: string;
  accountType: string;
  activationUrl?: string;
}

export interface PasswordResetContext {
  firstName: string;
  resetUrl: string;
  expiresIn: string;
}

export interface InvitationEmailContext {
  inviterName: string;
  accountName: string;
  accountType: string;
  role: string;
  joinUrl: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const emailConfig = {
      host: this.configService.get<string>('EMAIL_HOST'),
      port: this.configService.get<number>('EMAIL_PORT', 587),
      secure: this.configService.get<boolean>('EMAIL_SECURE', false),
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASSWORD')
      }
    };

    this.transporter = nodemailer.createTransport(emailConfig);

    if (this.configService.get('NODE_ENV') === 'development') {
      this.logger.log('Mail service initialized with configuration:', {
        host: emailConfig.host,
        port: emailConfig.port,
        user: emailConfig.auth.user
      });
    }
  }

  async sendMail(mailOptions: MailOptions): Promise<boolean> {
    const contextData = RequestContextService.getContext();
    const traceId = contextData?.traceId;

    try {
      const info = await this.transporter.sendMail({
        from: this.configService.get<string>('EMAIL_FROM', 'noreply@savium.com'),
        to: Array.isArray(mailOptions.to) ? mailOptions.to.join(', ') : mailOptions.to,
        subject: mailOptions.subject,
        html: mailOptions.html,
        text: mailOptions.text
      });

      this.logger.log(`Email sent successfully [${traceId}]`, {
        traceId,
        messageId: info.messageId,
        to: mailOptions.to,
        subject: mailOptions.subject,
        type: 'EMAIL_SENT'
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to send email [${traceId}]`, {
        traceId,
        error: error.message,
        to: mailOptions.to,
        subject: mailOptions.subject,
        type: 'EMAIL_ERROR'
      });

      // In production, you might want to queue failed emails for retry
      if (this.configService.get('NODE_ENV') === 'development') {
        throw error;
      }

      return false;
    }
  }

  async sendWelcomeEmail(to: string, context: WelcomeEmailContext): Promise<boolean> {
    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; text-align: center;">Welcome to Savium!</h1>
        <p>Hi ${context.firstName},</p>
        <p>Welcome to Savium! We're excited to help you manage your finances with our ${context.accountType} account.</p>
        ${
      context.activationUrl
        ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${context.activationUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Activate Your Account
            </a>
          </div>
        `
        : ''
    }
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <p>Best regards,<br>The Savium Team</p>
      </div>
    `;

    return this.sendMail({
      to,
      subject: 'Welcome to Savium - Get Started with Your Finance Management',
      html: htmlTemplate
    });
  }

  async sendPasswordResetEmail(to: string, context: PasswordResetContext): Promise<boolean> {
    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; text-align: center;">Password Reset Request</h1>
        <p>Hi ${context.firstName},</p>
        <p>You requested to reset your password for your Savium account. Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${context.resetUrl}" 
             style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p><strong>This link will expire in ${context.expiresIn}.</strong></p>
        <p>If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
        <p>Best regards,<br>The Savium Team</p>
      </div>
    `;

    return this.sendMail({
      to,
      subject: 'Password Reset Request - Savium',
      html: htmlTemplate
    });
  }

  async sendAccountInvitationEmail(to: string, context: InvitationEmailContext): Promise<boolean> {
    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; text-align: center;">You're Invited!</h1>
        <p>Hi there,</p>
        <p>${context.inviterName} has invited you to join "${context.accountName}" as a ${context.role} in their ${context.accountType} account on Savium.</p>
        <p>Savium helps you track transactions, manage budgets, and achieve your financial goals together.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${context.joinUrl}" 
             style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Accept Invitation
          </a>
        </div>
        <p>If you don't want to join this account, you can simply ignore this email.</p>
        <p>Best regards,<br>The Savium Team</p>
      </div>
    `;

    return this.sendMail({
      to,
      subject: `Invitation to join ${context.accountName} on Savium`,
      html: htmlTemplate
    });
  }

  async sendTransactionDigest(to: string, accountName: string, transactions: any[], period: string): Promise<boolean> {
    const totalAmount = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    const transactionList = transactions
      .slice(0, 10) // Show only first 10 transactions
      .map(
        transaction => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${transaction.description}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${transaction.amount.toFixed(2)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${new Date(transaction.date).toLocaleDateString()}</td>
        </tr>
      `
      )
      .join('');

    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; text-align: center;">${period} Transaction Summary</h1>
        <p>Hi there,</p>
        <p>Here's your transaction summary for ${accountName} for the ${period.toLowerCase()}:</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin: 0; color: #333;">Total Transactions: $${totalAmount.toFixed(2)}</h3>
          <p style="margin: 10px 0 0 0;">Number of transactions: ${transactions.length}</p>
        </div>

        ${
      transactions.length > 0
        ? `
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #e9ecef;">
                <th style="padding: 12px; text-align: left;">Description</th>
                <th style="padding: 12px; text-align: right;">Amount</th>
                <th style="padding: 12px; text-align: left;">Date</th>
              </tr>
            </thead>
            <tbody>
              ${transactionList}
            </tbody>
          </table>
          ${transactions.length > 10 ? `<p><em>... and ${transactions.length - 10} more transactions</em></p>` : ''}
        `
        : '<p>No transactions recorded for this period.</p>'
    }

        <p>Log in to Savium to see your complete financial overview and manage your budgets.</p>
        <p>Best regards,<br>The Savium Team</p>
      </div>
    `;

    return this.sendMail({
      to,
      subject: `${period} Transaction Summary for ${accountName}`,
      html: htmlTemplate
    });
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('Mail service connection verified successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to verify mail service connection:', error.message);
      return false;
    }
  }
}
