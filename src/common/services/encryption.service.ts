import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { EncryptionException } from '@common/exceptions/card.exceptions';

export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  private readonly keyLength = 32; // 256 bits

  constructor(private readonly configService: ConfigService) {
    const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');

    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    // Validate key length
    if (encryptionKey.length !== this.keyLength * 2) {
      // Hex string should be 64 chars for 32 bytes
      throw new Error(`ENCRYPTION_KEY must be ${this.keyLength * 2} characters (${this.keyLength} bytes in hex format)`);
    }

    try {
      this.key = Buffer.from(encryptionKey, 'hex');
    } catch (error) {
      throw new Error('ENCRYPTION_KEY must be a valid hexadecimal string');
    }

    this.logger.log('Encryption service initialized successfully');
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   * @param text - Plain text to encrypt
   * @returns Encrypted data with IV and auth tag
   */
  encrypt(text: string): EncryptedData {
    if (!text || text.trim() === '') {
      throw new EncryptionException('Cannot encrypt empty text');
    }

    try {
      // Generate a random initialization vector
      const iv = crypto.randomBytes(16);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      // Encrypt the text
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get the authentication tag
      const authTag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      this.logger.error('Failed to encrypt data', error);
      throw new EncryptionException('Encryption failed');
    }
  }

  /**
   * Decrypt encrypted data using AES-256-GCM
   * @param encryptedData - Encrypted data with IV and auth tag
   * @returns Decrypted plain text
   */
  decrypt(encryptedData: EncryptedData): string {
    if (!encryptedData?.encrypted || !encryptedData?.iv || !encryptedData?.authTag) {
      throw new EncryptionException('Invalid encrypted data format');
    }

    try {
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, Buffer.from(encryptedData.iv, 'hex'));

      // Set authentication tag
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

      // Decrypt the data
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Failed to decrypt data', error);
      throw new EncryptionException('Decryption failed');
    }
  }

  /**
   * Encrypt last four digits of a card (PCI DSS compliant)
   * @param lastFour - Last four digits as string
   * @returns Encrypted data
   */
  encryptLastFourDigits(lastFour: string): EncryptedData {
    if (!lastFour || !/^\d{4}$/.test(lastFour)) {
      throw new EncryptionException('Last four digits must be exactly 4 numeric characters');
    }

    return this.encrypt(lastFour);
  }

  /**
   * Decrypt last four digits and return as masked string
   * @param encryptedData - Encrypted last four digits
   * @returns Masked card number (e.g., "****1234")
   */
  decryptAndMaskLastFour(encryptedData: EncryptedData): string {
    const lastFour = this.decrypt(encryptedData);
    return `****${lastFour}`;
  }

  /**
   * Hash sensitive data for comparison purposes (one-way)
   * @param data - Data to hash
   * @param salt - Optional salt (generated if not provided)
   * @returns Hash with salt
   */
  hash(data: string, salt?: string): { hash: string; salt: string } {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(data, actualSalt, 10000, 64, 'sha512').toString('hex');

    return {
      hash,
      salt: actualSalt
    };
  }

  /**
   * Verify hashed data
   * @param data - Plain text data
   * @param hash - Hash to verify against
   * @param salt - Salt used for hashing
   * @returns True if data matches hash
   */
  verifyHash(data: string, hash: string, salt: string): boolean {
    const { hash: computedHash } = this.hash(data, salt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
  }

  /**
   * Generate a cryptographically secure random string
   * @param length - Length of the random string
   * @returns Random hex string
   */
  generateRandomString(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate encryption key for configuration
   * This method should only be used during setup/configuration
   * @returns 256-bit encryption key in hex format
   */
  static generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate encrypted data structure
   * @param data - Data to validate
   * @returns True if data has valid encrypted structure
   */
  isValidEncryptedData(data: any): data is EncryptedData {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.encrypted === 'string' &&
      typeof data.iv === 'string' &&
      typeof data.authTag === 'string' &&
      data.encrypted.length > 0 &&
      data.iv.length === 32 && // 16 bytes in hex
      data.authTag.length === 32 // 16 bytes in hex
    );
  }

  /**
   * Securely wipe sensitive data from memory
   * @param data - String or Buffer to wipe
   */
  secureWipe(data: string | Buffer): void {
    if (typeof data === 'string') {
      // For strings, we can't directly wipe memory, but we can discourage optimization
      data = '';
    } else if (Buffer.isBuffer(data)) {
      // For buffers, we can fill with random data
      crypto.randomFillSync(data);
    }
  }

  /**
   * Create a masked version of sensitive data for logging
   * @param data - Sensitive data to mask
   * @param visibleChars - Number of characters to show at the end
   * @returns Masked string
   */
  maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (!data || data.length <= visibleChars) {
      return '*'.repeat(data?.length || 0);
    }

    const maskedLength = data.length - visibleChars;
    const mask = '*'.repeat(maskedLength);
    const visible = data.slice(-visibleChars);

    return mask + visible;
  }

  /**
   * Validate that the encryption service is working correctly
   * @returns True if encryption/decryption works correctly
   */
  validateService(): boolean {
    try {
      const testData = 'test-encryption-data';
      const encrypted = this.encrypt(testData);
      const decrypted = this.decrypt(encrypted);

      return testData === decrypted;
    } catch (error) {
      this.logger.error('Encryption service validation failed', error);
      return false;
    }
  }
}
