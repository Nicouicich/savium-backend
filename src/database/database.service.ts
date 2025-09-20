import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ClientSession, Connection } from 'mongoose';

@Injectable()
export class DatabaseService {
  constructor(@InjectConnection() private connection: Connection) {}

  async startSession(): Promise<ClientSession> {
    return this.connection.startSession();
  }

  async withTransaction<T>(operation: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.startSession();

    try {
      return await session.withTransaction(operation);
    } finally {
      await session.endSession();
    }
  }
}
