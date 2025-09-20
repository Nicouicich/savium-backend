import { Currency, PaymentMethod } from '@common/constants/transaction-categories';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttachedFileResponseDto {
  @ApiProperty({ description: 'File ID' })
  id: string;

  @ApiProperty({ description: 'Original filename' })
  filename: string;

  @ApiProperty({ description: 'Original name when uploaded' })
  originalName: string;

  @ApiProperty({ description: 'MIME type' })
  mimeType: string;

  @ApiProperty({ description: 'File size in bytes' })
  size: number;

  @ApiPropertyOptional({ description: 'Public URL to access file' })
  url?: string;

  @ApiProperty({ description: 'Upload timestamp' })
  uploadedAt: Date;
}

export class LocationResponseDto {
  @ApiProperty({ description: 'Latitude' })
  latitude: number;

  @ApiProperty({ description: 'Longitude' })
  longitude: number;

  @ApiPropertyOptional({ description: 'Address' })
  address?: string;
}

export class SplitResponseDto {
  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'User name' })
  userName: string;

  @ApiProperty({ description: 'User email' })
  userEmail: string;

  @ApiProperty({ description: 'Amount for this user' })
  amount: number;

  @ApiPropertyOptional({ description: 'Percentage of total' })
  percentage?: number;

  @ApiProperty({ description: 'Whether user has paid' })
  paid: boolean;
}

export class SplitDetailsResponseDto {
  @ApiProperty({ description: 'Total amount being split' })
  totalAmount: number;

  @ApiProperty({
    description: 'Split method',
    enum: ['equal', 'percentage', 'amount']
  })
  splitMethod: 'equal' | 'percentage' | 'amount';

  @ApiProperty({
    type: [SplitResponseDto],
    description: 'Split details for each user'
  })
  splits: SplitResponseDto[];
}

export class RecurringPatternResponseDto {
  @ApiProperty({
    description: 'Frequency of recurrence',
    enum: ['daily', 'weekly', 'monthly', 'yearly']
  })
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';

  @ApiProperty({ description: 'Interval between occurrences' })
  interval: number;

  @ApiPropertyOptional({ description: 'End date for recurrence' })
  endDate?: Date;

  @ApiPropertyOptional({ description: 'Next occurrence date' })
  nextOccurrence?: Date;
}

export class CategorySummaryDto {
  @ApiProperty({ description: 'Category ID' })
  id: string;

  @ApiProperty({ description: 'Category name' })
  name: string;

  @ApiProperty({ description: 'Category display name' })
  displayName: string;

  @ApiProperty({ description: 'Category icon' })
  icon: string;

  @ApiProperty({ description: 'Category color' })
  color: string;
}

export class UserSummaryDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'User email' })
  email: string;

  @ApiProperty({ description: 'User full name' })
  name: string;
}

export class TransactionResponseDto {
  @ApiProperty({ description: 'Transaction ID' })
  id: string;

  @ApiProperty({ description: 'Transaction description' })
  description: string;

  @ApiProperty({ description: 'Transaction amount' })
  amount: number;

  @ApiProperty({ enum: Currency, description: 'Currency' })
  currency: Currency;

  @ApiProperty({ description: 'Transaction date' })
  date: Date;

  @ApiProperty({ type: CategorySummaryDto, description: 'Category details' })
  category: CategorySummaryDto;

  @ApiPropertyOptional({ description: 'Subcategory name' })
  subcategoryName?: string;

  @ApiProperty({ description: 'Profile ID' })
  profileId: string;

  @ApiProperty({
    type: UserSummaryDto,
    description: 'User who created the transaction'
  })
  user: UserSummaryDto;

  @ApiProperty({ enum: PaymentMethod, description: 'Payment method' })
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ description: 'Vendor name' })
  vendor?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  notes?: string;

  @ApiProperty({
    type: [AttachedFileResponseDto],
    description: 'Attached files'
  })
  attachedFiles: AttachedFileResponseDto[];

  @ApiProperty({ description: 'Whether transaction is recurring' })
  isRecurring: boolean;

  @ApiPropertyOptional({
    type: RecurringPatternResponseDto,
    description: 'Recurring pattern if applicable'
  })
  recurringPattern?: RecurringPatternResponseDto;

  @ApiProperty({ description: 'Whether transaction is shared' })
  isSharedTransaction: boolean;

  @ApiProperty({
    type: [UserSummaryDto],
    description: 'Users transaction is shared with'
  })
  sharedWith: UserSummaryDto[];

  @ApiPropertyOptional({
    type: SplitDetailsResponseDto,
    description: 'Split details for shared transactions'
  })
  splitDetails?: SplitDetailsResponseDto;

  @ApiProperty({ description: 'Whether transaction needs review' })
  needsReview: boolean;

  @ApiPropertyOptional({ description: 'Review reason' })
  reviewReason?: string;

  @ApiPropertyOptional({ description: 'Who reviewed the transaction' })
  reviewedBy?: UserSummaryDto;

  @ApiPropertyOptional({ description: 'When transaction was reviewed' })
  reviewedAt?: Date;

  @ApiProperty({
    description: 'Transaction status',
    enum: ['active', 'pending_approval', 'approved', 'rejected']
  })
  status: string;

  @ApiProperty({ description: 'Whether transaction is private' })
  isPrivate: boolean;

  @ApiProperty({ description: 'Whether transaction is flagged' })
  isFlagged: boolean;

  @ApiPropertyOptional({ description: 'Flag reason' })
  flagReason?: string;

  @ApiPropertyOptional({
    type: LocationResponseDto,
    description: 'Location where transaction occurred'
  })
  location?: LocationResponseDto;

  @ApiProperty({ type: [String], description: 'Transaction tags' })
  tags: string[];

  @ApiProperty({ description: 'Data source' })
  source: string;

  @ApiPropertyOptional({ description: 'AI confidence score' })
  confidence?: number;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;

  @ApiProperty({ description: 'Whether user can edit this transaction' })
  canEdit: boolean;

  @ApiProperty({ description: 'Whether user can delete this transaction' })
  canDelete: boolean;
}

export class TransactionListResponseDto {
  @ApiProperty({ type: [TransactionResponseDto], description: 'List of transactions' })
  transactions: TransactionResponseDto[];

  @ApiProperty({ description: 'Total number of transactions' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ description: 'Whether there are more pages' })
  hasNextPage: boolean;

  @ApiProperty({ description: 'Whether there are previous pages' })
  hasPrevPage: boolean;
}

export class TransactionStatsResponseDto {
  @ApiProperty({ description: 'Total amount spent' })
  totalAmount: number;

  @ApiProperty({ description: 'Number of transactions' })
  totalTransactions: number;

  @ApiProperty({ description: 'Average transaction amount' })
  averageAmount: number;

  @ApiProperty({ description: 'Highest transaction amount' })
  maxAmount: number;

  @ApiProperty({ description: 'Lowest transaction amount' })
  minAmount: number;

  @ApiProperty({ description: 'Currency of amounts' })
  currency: Currency;

  @ApiProperty({ description: 'Date range start' })
  periodStart: Date;

  @ApiProperty({ description: 'Date range end' })
  periodEnd: Date;
}
