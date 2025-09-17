import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

import { AiService, TicketProcessingResult } from './ai.service';
import { MessagingFileService } from '../../files/services/messaging-file.service';
import { S3Service } from '../../files/services/s3.service';
import { FileManagementService } from '../../files/services/file-management.service';
import { ExpensesService } from '../../expenses/expenses.service';
import { CategoriesService } from '../../categories/categories.service';
import { FilePurpose } from '../../files/schemas/file-metadata.schema';

export interface ReceiptProcessingResult {
  isReceipt: boolean;
  confidence: number;
  fileUploaded?: {
    fileId: string;
    s3Key: string;
    url?: string;
  };
  expenseCreated?: {
    expenseId: string;
    amount: number;
    description: string;
  };
  extractedData?: TicketProcessingResult;
  error?: string;
}

@Injectable()
export class ReceiptProcessorService {
  private readonly logger = new Logger(ReceiptProcessorService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly messagingFileService: MessagingFileService,
    private readonly s3Service: S3Service,
    private readonly fileManagementService: FileManagementService,
    private readonly expensesService: ExpensesService,
    private readonly categoriesService: CategoriesService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Process an image to determine if it's a receipt and create expense if so
   */
  async processImageFromWhatsApp(
    fileId: string,
    userId: string,
    accountId: string,
    options: {
      caption?: string;
      traceId?: string;
    } = {}
  ): Promise<ReceiptProcessingResult> {
    const { caption, traceId } = options;

    this.logger.log('Processing potential receipt image from WhatsApp', {
      traceId,
      fileId,
      userId,
      accountId
    });

    try {
      // Step 1: Download and upload file to S3
      const uploadResult = await this.messagingFileService.uploadMessagingFile(
        {
          fileId,
          platform: 'whatsapp',
          caption
        },
        userId,
        accountId,
        {
          purpose: FilePurpose.RECEIPT,
          description: `Potential receipt from WhatsApp: ${caption || 'No description'}`,
          tags: ['whatsapp', 'potential_receipt', 'unprocessed'],
          traceId
        }
      );

      this.logger.log('File uploaded to S3', {
        traceId,
        fileId: uploadResult.fileId,
        s3Key: uploadResult.s3Key
      });

      // Step 2: Download file buffer for AI processing
      const fileBuffer = await this.downloadFileBuffer(uploadResult.s3Key);
      if (!fileBuffer) {
        throw new Error('Failed to download uploaded file for AI processing');
      }

      // Step 3: Detect if image is a receipt using AI
      const detectedMimeType = 'image/jpeg'; // Default fallback since S3UploadResult doesn't include mimeType
      const isReceiptResult = await this.detectReceipt(fileBuffer, detectedMimeType);

      if (!isReceiptResult.isReceipt) {
        this.logger.log('Image determined not to be a receipt', {
          traceId,
          confidence: isReceiptResult.confidence
        });

        // Update file tags to indicate it's not a receipt
        await this.updateFileMetadata(
          uploadResult.fileId,
          {
            tags: ['whatsapp', 'not_receipt', 'general_image'],
            purpose: FilePurpose.GENERAL
          },
          userId,
          accountId
        );

        return {
          isReceipt: false,
          confidence: isReceiptResult.confidence,
          fileUploaded: {
            fileId: uploadResult.fileId,
            s3Key: uploadResult.s3Key,
            url: uploadResult.url
          }
        };
      }

      // Step 4: Process receipt with AI to extract expense data
      const extractedData = await this.aiService.processTicketImage(fileBuffer, detectedMimeType);

      this.logger.log('Receipt data extracted', {
        traceId,
        amount: extractedData.amount,
        vendor: extractedData.vendor,
        confidence: extractedData.confidence
      });

      // Step 5: Create expense if we have sufficient data
      let expenseCreated;
      if (extractedData.amount && extractedData.amount > 0) {
        try {
          expenseCreated = await this.createExpenseFromReceipt(extractedData, uploadResult.fileId, userId, accountId, traceId);

          // Update file metadata to link to expense
          await this.updateFileMetadata(
            uploadResult.fileId,
            {
              tags: ['whatsapp', 'receipt', 'processed', 'expense_created'],
              purpose: FilePurpose.RECEIPT,
              description: `Receipt processed - Expense #${expenseCreated.expenseId}`
            },
            userId,
            accountId
          );
        } catch (expenseError) {
          this.logger.error('Failed to create expense from receipt', {
            traceId,
            error: expenseError.message
          });

          // Update file to indicate processing error
          await this.updateFileMetadata(
            uploadResult.fileId,
            {
              tags: ['whatsapp', 'receipt', 'processing_error'],
              purpose: FilePurpose.RECEIPT
            },
            userId,
            accountId
          );
        }
      }

      return {
        isReceipt: true,
        confidence: isReceiptResult.confidence,
        fileUploaded: {
          fileId: uploadResult.fileId,
          s3Key: uploadResult.s3Key,
          url: uploadResult.url
        },
        expenseCreated,
        extractedData
      };
    } catch (error) {
      this.logger.error('Error processing receipt image', {
        traceId,
        error: error.message,
        stack: error.stack
      });

      return {
        isReceipt: false,
        confidence: 0,
        error: error.message
      };
    }
  }

  /**
   * Detect if an image contains a receipt using AI
   */
  private async detectReceipt(imageBuffer: Buffer, mimeType: string): Promise<{ isReceipt: boolean; confidence: number }> {
    if (!this.aiService.isAiEnabled()) {
      // Fallback: assume all images are potential receipts
      return { isReceipt: true, confidence: 0.5 };
    }

    try {
      // Use a simple prompt to detect receipts
      const base64Image = imageBuffer.toString('base64');
      const imageUrl = `data:${mimeType};base64,${base64Image}`;

      // This would be implemented with a separate AI call optimized for classification
      // For now, we'll use the existing ticket processing and check confidence
      const result = await this.aiService.processTicketImage(imageBuffer, mimeType);

      // Consider it a receipt if:
      // 1. AI found an amount or vendor with reasonable confidence
      // 2. Extracted text contains receipt-like keywords
      const hasAmount = result.amount && result.amount > 0;
      const hasVendor = result.vendor && result.vendor.length > 2;
      const hasReceiptKeywords =
        result.extractedText?.toLowerCase().includes('total') ||
        result.extractedText?.toLowerCase().includes('subtotal') ||
        result.extractedText?.toLowerCase().includes('receipt') ||
        result.extractedText?.toLowerCase().includes('tax');

      const isReceipt = hasAmount || (hasVendor && hasReceiptKeywords);
      const confidence = result.confidence || (isReceipt ? 0.7 : 0.2);

      return { isReceipt: Boolean(isReceipt), confidence };
    } catch (error) {
      this.logger.warn('Error detecting receipt, defaulting to true', error.message);
      return { isReceipt: true, confidence: 0.3 };
    }
  }

  /**
   * Create expense record from extracted receipt data
   */
  private async createExpenseFromReceipt(
    extractedData: TicketProcessingResult,
    fileId: string,
    userId: string,
    accountId: string,
    traceId?: string
  ): Promise<{ expenseId: string; amount: number; description: string }> {
    try {
      this.logger.log('Creating expense from receipt data', {
        traceId,
        amount: extractedData.amount,
        vendor: extractedData.vendor,
        fileId
      });

      // Get appropriate category based on AI suggestion
      const categoryId = await this.getCategoryByName(extractedData.suggestedCategory || 'Otros', accountId);

      const expenseData = {
        amount: extractedData.amount!,
        description: extractedData.description || `Purchase at ${extractedData.vendor || 'Unknown vendor'}`,
        date: extractedData.date || new Date(),
        categoryId,
        accountId,
        vendor: extractedData.vendor,
        notes: `Automatically created from receipt. AI confidence: ${(extractedData.confidence || 0) * 100}%`,
        attachedFiles: [fileId], // Use attachedFiles as expected by ExpensesService
        isRecurring: extractedData.isRecurring || false,
        installments: extractedData.installments,
        metadata: {
          source: 'whatsapp_receipt',
          confidence: extractedData.confidence,
          aiAnalysis: extractedData,
          receiptText: extractedData.extractedText,
          traceId,
          platform: 'whatsapp'
        }
      };

      // Create the expense using ExpensesService
      const expense = await this.expensesService.create(expenseData, userId);

      this.logger.log('Expense created successfully from receipt', {
        traceId,
        expenseId: expense.id, // Use UUID
        amount: expense.amount,
        fileId,
        categoryId
      });

      return {
        expenseId: expense.id, // Use UUID instead of MongoDB _id
        amount: expense.amount,
        description: expense.description
      };
    } catch (error) {
      this.logger.error('Failed to create expense from receipt', {
        traceId,
        error: error.message,
        stack: error.stack,
        extractedData
      });

      // Re-throw to be handled by caller
      throw new Error(`Failed to create expense: ${error.message}`);
    }
  }

  /**
   * Get category ID by name or return default category
   */
  private async getCategoryByName(categoryName: string, accountId: string): Promise<string> {
    try {
      // Try to find category by name
      const categories = await this.categoriesService.findAll(accountId);

      // Look for exact match first
      let category = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());

      // If no exact match, look for partial match
      if (!category) {
        category = categories.find(c => c.name.toLowerCase().includes(categoryName.toLowerCase()) || categoryName.toLowerCase().includes(c.name.toLowerCase()));
      }

      if (category) {
        this.logger.debug('Found matching category', {
          requestedCategory: categoryName,
          foundCategory: category.name,
          categoryId: category.id
        });

        return category.id; // Use UUID instead of MongoDB _id
      }

      // Fallback to default category (usually "Otros" or "General")
      const defaultCategory = categories.find(c => ['otros', 'general', 'miscellaneous', 'other'].includes(c.name.toLowerCase())) || categories[0]; // Use first category if no default found

      if (defaultCategory) {
        this.logger.debug('Using default category', {
          requestedCategory: categoryName,
          defaultCategory: defaultCategory.name,
          categoryId: defaultCategory.id
        });

        return defaultCategory.id; // Use UUID instead of MongoDB _id
      }

      // This should not happen if categories are properly set up
      throw new Error('No categories found for account');
    } catch (error) {
      this.logger.error('Error finding category', {
        categoryName,
        accountId,
        error: error.message
      });

      // Return a fallback ID or throw error
      throw new Error(`Failed to find category: ${error.message}`);
    }
  }

  /**
   * Download file buffer from S3 for processing
   */
  private async downloadFileBuffer(s3Key: string): Promise<Buffer | null> {
    try {
      this.logger.debug('Downloading file from S3 for AI processing', { s3Key });

      const result = await this.s3Service.downloadFile(s3Key);

      if (!result.Body) {
        this.logger.error('S3 download returned no body', { s3Key });
        return null;
      }

      // Convert Stream to Buffer if necessary
      if (result.Body instanceof Readable) {
        const chunks: Buffer[] = [];
        for await (const chunk of result.Body) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const buffer = Buffer.concat(chunks);

        this.logger.debug('File downloaded and converted to buffer', {
          s3Key,
          bufferSize: buffer.length
        });

        return buffer;
      }

      // If it's already a Buffer or Uint8Array
      if (Buffer.isBuffer(result.Body)) {
        return result.Body;
      }

      // Convert other types to Buffer
      const buffer = Buffer.from(result.Body as any);

      this.logger.debug('File downloaded as buffer', {
        s3Key,
        bufferSize: buffer.length
      });

      return buffer;
    } catch (error) {
      this.logger.error('Failed to download file from S3', {
        s3Key,
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  }

  /**
   * Update file metadata
   */
  private async updateFileMetadata(
    fileId: string,
    updates: {
      tags?: string[];
      purpose?: FilePurpose;
      description?: string;
    },
    userId: string,
    accountId: string
  ): Promise<void> {
    try {
      this.logger.debug('Updating file metadata', { fileId, updates, userId, accountId });

      // Update file metadata using FileManagementService
      await this.fileManagementService.updateFileMetadata(
        fileId,
        {
          purpose: updates.purpose,
          description: updates.description,
          tags: updates.tags
        },
        userId,
        accountId
      );

      this.logger.debug('File metadata updated successfully', { fileId, updates });
    } catch (error) {
      this.logger.warn('Failed to update file metadata', {
        fileId,
        updates,
        userId,
        accountId,
        error: error.message
      });

      // Don't throw error to avoid breaking the main flow
      // File metadata update is not critical for expense creation
    }
  }
}
