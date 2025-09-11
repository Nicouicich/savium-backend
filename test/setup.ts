import {TestSetup} from './helpers/test-helpers';

// Global test setup
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test-secret-access';
  process.env.JWT_REFRESH_SECRET = 'test-secret-refresh';

  // Increase timeout for database operations
  jest.setTimeout(30000);
});

// Global test cleanup
afterAll(async () => {
  await TestSetup.cleanup();
});

// Mock external services for tests
jest.mock('@nestjs/cache-manager', () => ({
  CACHE_MANAGER: 'CACHE_MANAGER',
  CacheModule: {
    register: jest.fn(() => ({
      module: 'MockCacheModule',
      providers: [
        {
          provide: 'CACHE_MANAGER',
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            reset: jest.fn()
          }
        }
      ],
      exports: ['CACHE_MANAGER']
    })),
    registerAsync: jest.fn(() => ({
      module: 'MockCacheModule',
      providers: [
        {
          provide: 'CACHE_MANAGER',
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            reset: jest.fn()
          }
        }
      ],
      exports: ['CACHE_MANAGER']
    }))
  }
}));

// Console overrides for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Suppress expected error/warning logs in tests unless debugging
  if (!process.env.DEBUG_TESTS) {
    console.error = jest.fn(message => {
      // Only suppress expected test errors, allow unexpected ones through
      if (typeof message === 'string' && !message.includes('Test error') && !message.includes('Expected error')) {
        originalConsoleError(message);
      }
    });

    console.warn = jest.fn(message => {
      // Only suppress expected test warnings
      if (typeof message === 'string' && !message.includes('Test warning') && !message.includes('Expected warning')) {
        originalConsoleWarn(message);
      }
    });
  }
});

afterEach(() => {
  // Restore console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;

  // Clear all mocks
  jest.clearAllMocks();
});

// Add custom matchers
expect.extend({
  toBeValidObjectId(received) {
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    const pass = typeof received === 'string' && objectIdRegex.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid ObjectId`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid ObjectId`,
        pass: false
      };
    }
  },

  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = typeof received === 'string' && emailRegex.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email`,
        pass: false
      };
    }
  },

  toBeValidMonetaryAmount(received) {
    const pass = typeof received === 'number' && received >= 0 && received <= 999999999.99 && Number(received.toFixed(2)) === received;

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid monetary amount`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid monetary amount (0-999,999,999.99 with max 2 decimal places)`,
        pass: false
      };
    }
  },

  toHaveValidTimestamps(received) {
    const hasCreatedAt = Object.prototype.hasOwnProperty.call(received, 'createdAt') && received.createdAt instanceof Date;
    const hasUpdatedAt = Object.prototype.hasOwnProperty.call(received, 'updatedAt') && received.updatedAt instanceof Date;

    const pass = hasCreatedAt && hasUpdatedAt;

    if (pass) {
      return {
        message: () => `expected object not to have valid timestamps`,
        pass: true
      };
    } else {
      return {
        message: () => `expected object to have valid createdAt and updatedAt timestamps`,
        pass: false
      };
    }
  }
});

// Extend Jest matchers type definition
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeValidObjectId(): R;
      toBeValidEmail(): R;
      toBeValidMonetaryAmount(): R;
      toHaveValidTimestamps(): R;
    }
  }
}

// Global test utilities
global.testUtils = {
  // Helper to create consistent test IDs
  createTestId: () => '507f1f77bcf86cd799439011',

  // Helper to create test dates
  createTestDate: (daysOffset = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date;
  },

  // Helper to format monetary amounts for testing
  formatMoney: (amount: number) => Number(amount.toFixed(2)),

  // Helper to wait for async operations in tests
  waitFor: async (condition: () => boolean, timeout = 5000) => {
    const start = Date.now();
    while (!condition() && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!condition()) {
      throw new Error(`Condition not met within ${timeout}ms`);
    }
  }
};

// Type definition for global test utils
declare global {
  var testUtils: {
    createTestId: () => string;
    createTestDate: (daysOffset?: number) => Date;
    formatMoney: (amount: number) => number;
    waitFor: (condition: () => boolean, timeout?: number) => Promise<void>;
  };
}
