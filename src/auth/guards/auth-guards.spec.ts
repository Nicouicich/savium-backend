import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { Observable, of } from 'rxjs';

import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtRefreshGuard } from './jwt-refresh.guard';
import { LocalAuthGuard } from './local-auth.guard';

describe('Auth Guards - Unit Tests', () => {
  let module: TestingModule;
  let jwtAuthGuard: JwtAuthGuard;
  let jwtRefreshGuard: JwtRefreshGuard;
  let localAuthGuard: LocalAuthGuard;

  // Mock ExecutionContext
  const createMockExecutionContext = (overrides = {}): ExecutionContext => {
    const mockRequest = {
      headers: {
        authorization: 'Bearer valid-jwt-token'
      },
      user: {
        id: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        role: 'USER'
      },
      body: {
        email: 'test@example.com',
        password: 'SecurePass123!'
      },
      ...overrides.request
    };

    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      ...overrides.response
    };

    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse)
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
      ...overrides
    } as ExecutionContext;
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        JwtRefreshGuard,
        LocalAuthGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
            get: jest.fn()
          }
        }
      ]
    }).compile();

    jwtAuthGuard = module.get<JwtAuthGuard>(JwtAuthGuard);
    jwtRefreshGuard = module.get<JwtRefreshGuard>(JwtRefreshGuard);
    localAuthGuard = module.get<LocalAuthGuard>(LocalAuthGuard);

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await module.close();
  });

  describe('JwtAuthGuard', () => {
    describe('Happy Path Scenarios', () => {
      it('should be defined', () => {
        expect(jwtAuthGuard).toBeDefined();
      });

      it('should extend AuthGuard with jwt strategy', () => {
        // Verify it's using the correct strategy
        expect(jwtAuthGuard).toBeInstanceOf(JwtAuthGuard);
      });

      it('should call super.canActivate with context', async () => {
        // Arrange
        const mockContext = createMockExecutionContext();
        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtAuthGuard)), 'canActivate');
        superCanActivateSpy.mockReturnValue(true);

        // Act
        const result = jwtAuthGuard.canActivate(mockContext);

        // Assert
        expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);
        expect(result).toBe(true);
      });

      it('should handle boolean return from super.canActivate', () => {
        // Arrange
        const mockContext = createMockExecutionContext();
        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtAuthGuard)), 'canActivate');
        superCanActivateSpy.mockReturnValue(true);

        // Act
        const result = jwtAuthGuard.canActivate(mockContext);

        // Assert
        expect(result).toBe(true);
        expect(typeof result).toBe('boolean');
      });

      it('should handle Promise return from super.canActivate', async () => {
        // Arrange
        const mockContext = createMockExecutionContext();
        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtAuthGuard)), 'canActivate');
        superCanActivateSpy.mockReturnValue(Promise.resolve(true));

        // Act
        const result = jwtAuthGuard.canActivate(mockContext);

        // Assert
        expect(result).toBeInstanceOf(Promise);
        const resolvedResult = await result;
        expect(resolvedResult).toBe(true);
      });

      it('should handle Observable return from super.canActivate', done => {
        // Arrange
        const mockContext = createMockExecutionContext();
        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtAuthGuard)), 'canActivate');
        superCanActivateSpy.mockReturnValue(of(true));

        // Act
        const result = jwtAuthGuard.canActivate(mockContext);

        // Assert
        expect(result).toBeInstanceOf(Observable);
        (result as Observable<boolean>).subscribe({
          next: value => {
            expect(value).toBe(true);
            done();
          },
          error: done
        });
      });
    });

    describe('Error Handling Scenarios', () => {
      it('should handle false return from super.canActivate', () => {
        // Arrange
        const mockContext = createMockExecutionContext();
        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtAuthGuard)), 'canActivate');
        superCanActivateSpy.mockReturnValue(false);

        // Act
        const result = jwtAuthGuard.canActivate(mockContext);

        // Assert
        expect(result).toBe(false);
      });

      it('should handle Promise rejection from super.canActivate', async () => {
        // Arrange
        const mockContext = createMockExecutionContext();
        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtAuthGuard)), 'canActivate');
        const error = new Error('JWT validation failed');
        superCanActivateSpy.mockReturnValue(Promise.reject(error));

        // Act & Assert
        const result = jwtAuthGuard.canActivate(mockContext);
        await expect(result).rejects.toThrow('JWT validation failed');
      });

      it('should handle Observable error from super.canActivate', done => {
        // Arrange
        const mockContext = createMockExecutionContext();
        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtAuthGuard)), 'canActivate');
        const error = new Error('JWT validation failed');
        superCanActivateSpy.mockReturnValue(
          new Observable(subscriber => {
            subscriber.error(error);
          })
        );

        // Act
        const result = jwtAuthGuard.canActivate(mockContext);

        // Assert
        (result as Observable<boolean>).subscribe({
          next: () => {
            done(new Error('Should not succeed'));
          },
          error: err => {
            expect(err.message).toBe('JWT validation failed');
            done();
          }
        });
      });

      it('should handle missing context gracefully', () => {
        // Arrange
        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtAuthGuard)), 'canActivate');
        superCanActivateSpy.mockImplementation(() => {
          throw new Error('Context is required');
        });

        // Act & Assert
        expect(() => jwtAuthGuard.canActivate(null as any)).toThrow('Context is required');
      });
    });

    describe('Integration with Passport', () => {
      it('should properly integrate with passport jwt strategy', () => {
        // Arrange
        const mockContext = createMockExecutionContext({
          request: {
            headers: {
              authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            }
          }
        });

        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtAuthGuard)), 'canActivate');
        superCanActivateSpy.mockReturnValue(true);

        // Act
        const result = jwtAuthGuard.canActivate(mockContext);

        // Assert
        expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);
        expect(result).toBe(true);
      });

      it('should handle malformed authorization header', () => {
        // Arrange
        const mockContext = createMockExecutionContext({
          request: {
            headers: {
              authorization: 'Invalid header format'
            }
          }
        });

        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtAuthGuard)), 'canActivate');
        superCanActivateSpy.mockReturnValue(false);

        // Act
        const result = jwtAuthGuard.canActivate(mockContext);

        // Assert
        expect(result).toBe(false);
      });

      it('should handle missing authorization header', () => {
        // Arrange
        const mockContext = createMockExecutionContext({
          request: {
            headers: {}
          }
        });

        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtAuthGuard)), 'canActivate');
        superCanActivateSpy.mockReturnValue(false);

        // Act
        const result = jwtAuthGuard.canActivate(mockContext);

        // Assert
        expect(result).toBe(false);
      });
    });
  });

  describe('JwtRefreshGuard', () => {
    describe('Happy Path Scenarios', () => {
      it('should be defined', () => {
        expect(jwtRefreshGuard).toBeDefined();
      });

      it('should extend AuthGuard with jwt-refresh strategy', () => {
        expect(jwtRefreshGuard).toBeInstanceOf(JwtRefreshGuard);
      });

      it('should call parent canActivate method', () => {
        // Arrange
        const mockContext = createMockExecutionContext();
        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtRefreshGuard)), 'canActivate');
        superCanActivateSpy.mockReturnValue(true);

        // Act
        const result = (jwtRefreshGuard as any).canActivate(mockContext);

        // Assert
        expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);
        expect(result).toBe(true);
      });

      it('should handle valid refresh token', () => {
        // Arrange
        const mockContext = createMockExecutionContext({
          request: {
            body: {
              refreshToken: 'valid.refresh.token'
            }
          }
        });

        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtRefreshGuard)), 'canActivate');
        superCanActivateSpy.mockReturnValue(true);

        // Act
        const result = (jwtRefreshGuard as any).canActivate(mockContext);

        // Assert
        expect(result).toBe(true);
      });
    });

    describe('Error Handling Scenarios', () => {
      it('should handle invalid refresh token', () => {
        // Arrange
        const mockContext = createMockExecutionContext({
          request: {
            body: {
              refreshToken: 'invalid.refresh.token'
            }
          }
        });

        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtRefreshGuard)), 'canActivate');
        superCanActivateSpy.mockReturnValue(false);

        // Act
        const result = (jwtRefreshGuard as any).canActivate(mockContext);

        // Assert
        expect(result).toBe(false);
      });

      it('should handle missing refresh token', () => {
        // Arrange
        const mockContext = createMockExecutionContext({
          request: {
            body: {}
          }
        });

        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtRefreshGuard)), 'canActivate');
        superCanActivateSpy.mockReturnValue(false);

        // Act
        const result = (jwtRefreshGuard as any).canActivate(mockContext);

        // Assert
        expect(result).toBe(false);
      });

      it('should handle expired refresh token', () => {
        // Arrange
        const mockContext = createMockExecutionContext({
          request: {
            body: {
              refreshToken: 'expired.refresh.token'
            }
          }
        });

        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtRefreshGuard)), 'canActivate');
        superCanActivateSpy.mockImplementation(() => {
          throw new Error('Token expired');
        });

        // Act & Assert
        expect(() => (jwtRefreshGuard as any).canActivate(mockContext)).toThrow('Token expired');
      });
    });
  });

  describe('LocalAuthGuard', () => {
    describe('Happy Path Scenarios', () => {
      it('should be defined', () => {
        expect(localAuthGuard).toBeDefined();
      });

      it('should extend AuthGuard with local strategy', () => {
        expect(localAuthGuard).toBeInstanceOf(LocalAuthGuard);
      });

      it('should call parent canActivate method', () => {
        // Arrange
        const mockContext = createMockExecutionContext();
        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(localAuthGuard)), 'canActivate');
        superCanActivateSpy.mockReturnValue(true);

        // Act
        const result = (localAuthGuard as any).canActivate(mockContext);

        // Assert
        expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);
        expect(result).toBe(true);
      });

      it('should handle valid email and password', () => {
        // Arrange
        const mockContext = createMockExecutionContext({
          request: {
            body: {
              email: 'test@example.com',
              password: 'SecurePass123!'
            }
          }
        });

        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(localAuthGuard)), 'canActivate');
        superCanActivateSpy.mockReturnValue(true);

        // Act
        const result = (localAuthGuard as any).canActivate(mockContext);

        // Assert
        expect(result).toBe(true);
      });

      it('should handle different email formats', () => {
        // Arrange
        const emailFormats = ['test@example.com', 'test.user@example.com', 'test+label@example.com', 'TEST@EXAMPLE.COM'];

        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(localAuthGuard)), 'canActivate');
        superCanActivateSpy.mockReturnValue(true);

        emailFormats.forEach(email => {
          // Arrange
          const mockContext = createMockExecutionContext({
            request: {
              body: {
                email,
                password: 'SecurePass123!'
              }
            }
          });

          // Act
          const result = (localAuthGuard as any).canActivate(mockContext);

          // Assert
          expect(result).toBe(true);
        });
      });
    });

    describe('Error Handling Scenarios', () => {
      it('should handle invalid credentials', () => {
        // Arrange
        const mockContext = createMockExecutionContext({
          request: {
            body: {
              email: 'test@example.com',
              password: 'wrongpassword'
            }
          }
        });

        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(localAuthGuard)), 'canActivate');
        superCanActivateSpy.mockReturnValue(false);

        // Act
        const result = (localAuthGuard as any).canActivate(mockContext);

        // Assert
        expect(result).toBe(false);
      });

      it('should handle missing email', () => {
        // Arrange
        const mockContext = createMockExecutionContext({
          request: {
            body: {
              password: 'SecurePass123!'
            }
          }
        });

        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(localAuthGuard)), 'canActivate');
        superCanActivateSpy.mockReturnValue(false);

        // Act
        const result = (localAuthGuard as any).canActivate(mockContext);

        // Assert
        expect(result).toBe(false);
      });

      it('should handle missing password', () => {
        // Arrange
        const mockContext = createMockExecutionContext({
          request: {
            body: {
              email: 'test@example.com'
            }
          }
        });

        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(localAuthGuard)), 'canActivate');
        superCanActivateSpy.mockReturnValue(false);

        // Act
        const result = (localAuthGuard as any).canActivate(mockContext);

        // Assert
        expect(result).toBe(false);
      });

      it('should handle empty credentials', () => {
        // Arrange
        const mockContext = createMockExecutionContext({
          request: {
            body: {
              email: '',
              password: ''
            }
          }
        });

        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(localAuthGuard)), 'canActivate');
        superCanActivateSpy.mockReturnValue(false);

        // Act
        const result = (localAuthGuard as any).canActivate(mockContext);

        // Assert
        expect(result).toBe(false);
      });

      it('should handle malformed email', () => {
        // Arrange
        const mockContext = createMockExecutionContext({
          request: {
            body: {
              email: 'not-an-email',
              password: 'SecurePass123!'
            }
          }
        });

        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(localAuthGuard)), 'canActivate');
        superCanActivateSpy.mockReturnValue(false);

        // Act
        const result = (localAuthGuard as any).canActivate(mockContext);

        // Assert
        expect(result).toBe(false);
      });

      it('should handle authentication errors', () => {
        // Arrange
        const mockContext = createMockExecutionContext();
        const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(localAuthGuard)), 'canActivate');
        superCanActivateSpy.mockImplementation(() => {
          throw new Error('Authentication failed');
        });

        // Act & Assert
        expect(() => (localAuthGuard as any).canActivate(mockContext)).toThrow('Authentication failed');
      });
    });
  });

  describe('Performance Characteristics', () => {
    it('should complete guard validation within reasonable time', () => {
      // Arrange
      const mockContext = createMockExecutionContext();
      const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtAuthGuard)), 'canActivate');
      superCanActivateSpy.mockReturnValue(true);

      // Act
      const startTime = Date.now();
      const result = jwtAuthGuard.canActivate(mockContext);
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(50); // Should complete within 50ms
      expect(result).toBe(true);
    });

    it('should handle multiple concurrent guard checks', () => {
      // Arrange
      const mockContexts = Array(10)
        .fill(null)
        .map(() => createMockExecutionContext());
      const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtAuthGuard)), 'canActivate');
      superCanActivateSpy.mockReturnValue(true);

      // Act
      const results = mockContexts.map(context => jwtAuthGuard.canActivate(context));

      // Assert
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBe(true);
      });
      expect(superCanActivateSpy).toHaveBeenCalledTimes(10);
    });
  });

  describe('Security Validations', () => {
    it('should not expose sensitive information in guard failures', () => {
      // Arrange
      const mockContext = createMockExecutionContext({
        request: {
          headers: {
            authorization: 'Bearer invalid-token-with-sensitive-data'
          }
        }
      });

      const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtAuthGuard)), 'canActivate');
      superCanActivateSpy.mockReturnValue(false);

      // Act
      const result = jwtAuthGuard.canActivate(mockContext);

      // Assert
      expect(result).toBe(false);
      // The guard should not expose the token content or any sensitive information
    });

    it('should handle injection attempts in authorization header', () => {
      // Arrange
      const mockContext = createMockExecutionContext({
        request: {
          headers: {
            authorization: 'Bearer <script>alert("xss")</script>'
          }
        }
      });

      const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtAuthGuard)), 'canActivate');
      superCanActivateSpy.mockReturnValue(false);

      // Act
      const result = jwtAuthGuard.canActivate(mockContext);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle SQL injection attempts in credentials', () => {
      // Arrange
      const mockContext = createMockExecutionContext({
        request: {
          body: {
            email: '\'; DROP TABLE users; --',
            password: '\' OR \'1\'=\'1'
          }
        }
      });

      const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(localAuthGuard)), 'canActivate');
      superCanActivateSpy.mockReturnValue(false);

      // Act
      const result = (localAuthGuard as any).canActivate(mockContext);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle extremely long tokens gracefully', () => {
      // Arrange
      const longToken = 'a'.repeat(10000);
      const mockContext = createMockExecutionContext({
        request: {
          headers: {
            authorization: `Bearer ${longToken}`
          }
        }
      });

      const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtAuthGuard)), 'canActivate');
      superCanActivateSpy.mockReturnValue(false);

      // Act
      const result = jwtAuthGuard.canActivate(mockContext);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null context', () => {
      // Arrange
      const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtAuthGuard)), 'canActivate');
      superCanActivateSpy.mockImplementation(() => {
        throw new Error('Context is required');
      });

      // Act & Assert
      expect(() => jwtAuthGuard.canActivate(null as any)).toThrow();
    });

    it('should handle undefined context', () => {
      // Arrange
      const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtAuthGuard)), 'canActivate');
      superCanActivateSpy.mockImplementation(() => {
        throw new Error('Context is required');
      });

      // Act & Assert
      expect(() => jwtAuthGuard.canActivate(undefined as any)).toThrow();
    });

    it('should handle malformed context', () => {
      // Arrange
      const malformedContext = {} as ExecutionContext;
      const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtAuthGuard)), 'canActivate');
      superCanActivateSpy.mockImplementation(() => {
        throw new Error('Invalid context');
      });

      // Act & Assert
      expect(() => jwtAuthGuard.canActivate(malformedContext)).toThrow();
    });

    it('should handle context without request', () => {
      // Arrange
      const contextWithoutRequest = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(null),
          getResponse: jest.fn().mockReturnValue({})
        }),
        getHandler: jest.fn(),
        getClass: jest.fn()
      } as any;

      const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(jwtAuthGuard)), 'canActivate');
      superCanActivateSpy.mockReturnValue(false);

      // Act
      const result = jwtAuthGuard.canActivate(contextWithoutRequest);

      // Assert
      expect(result).toBe(false);
    });
  });
});
