import { registerAs } from '@nestjs/config';

export default registerAs('database', () => {
  // Use local MongoDB connection
  const mongoUri = 'mongodb://localhost:27017/savium_dev';

  console.log('Using MongoDB connection:', mongoUri);

  return {
    uri: mongoUri,
    testUri: 'mongodb://localhost:27017/savium_test',
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
  };
});
