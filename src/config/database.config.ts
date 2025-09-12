import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  uri: process.env.DATABASE_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/savium_dev',
  testUri: process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/savium_test',
  options: {
    // Connection pool settings
    maxPoolSize: 10,
    minPoolSize: 2,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,

    // Replica set options
    retryWrites: true,
    w: 'majority'

    // Connection options (deprecated options removed for MongoDB Driver v6+)
  }
}));
