import { Currency } from '@common/constants/transaction-categories';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, PipelineStage, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { CreateTransactionDto, TransactionQueryDto, UpdateTransactionDto } from './dto';
import { Transaction, TransactionDocument } from './schemas/transaction.schema';

export interface TransactionStats {
  totalAmount: number;
  totalTransactions: number;
  averageAmount: number;
  maxAmount: number;
  minAmount: number;
  currency: Currency;
  periodStart: Date;
  periodEnd: Date;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

@Injectable()
export class TransactionsRepository {
  constructor (
    @InjectModel(Transaction.name) private readonly transactionModel: Model<TransactionDocument>
  ) {}

  async create(createTransactionDto: CreateTransactionDto): Promise<TransactionDocument[]> {
    if (createTransactionDto.isInstallment && createTransactionDto.installment) {
      const { total } = createTransactionDto.installment;
      const installmentId = uuidv4();

      const baseAmount = +(createTransactionDto.amount / total).toFixed(2);
      const startDate = createTransactionDto.date || new Date();
      const transactions: TransactionDocument[] = [];
      for (let i = 0; i < total; i++) {
        const date = new Date(startDate);

        date.setMonth(startDate.getMonth() + i);

        const transaction = new this.transactionModel({
          ...createTransactionDto,
          amount: baseAmount,
          category: createTransactionDto.categoryId,
          date,
          isInstallment: true,
          installmentId,
          installment: {
            current: i + 1,
            total: total
          }
        });

        transactions.push(transaction);
      }

      return this.transactionModel.insertMany(transactions);
    }

    const payload = {
      ...createTransactionDto,
      category: createTransactionDto.categoryId
    };

    const transaction = new this.transactionModel(payload);
    return [await transaction.save()];
  }


}
