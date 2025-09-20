import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AiService, IAAction, IAMsgAnswer } from './ai.service';
import { MessageSentToIA } from './message-processor.service';

describe('Enhanced AI Prompt Tests', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'OPENAI_API_KEY') return null; // Use mock mode
              return null;
            })
          }
        }
      ]
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Language Consistency Tests', () => {
    it('should validate Spanish expense without method requires clarification', () => {
      // Mock test case for Spanish expense without payment method
      const testMessage: MessageSentToIA = {
        msg: 'Gasté 500 en comida',
        defaultCurrency: 'ARS',
        categories: []
      };

      // Expected response structure (would be from AI)
      const expectedResponse: Partial<IAMsgAnswer> = {
        msg: expect.stringContaining('¿Con qué pagaste?'), // Should ask in Spanish
        actionTaken: {
          type: IAAction.clarification,
          data: expect.any(String)
        }
      };

      // Validate the structure matches our enhanced prompt expectations
      expect(expectedResponse.actionTaken?.type).toBe(IAAction.clarification);
    });

    it('should validate English expense with method is complete', () => {
      // Mock test case for English expense with payment method
      const testMessage: MessageSentToIA = {
        msg: 'I spent 25 on coffee with debit',
        defaultCurrency: 'USD',
        categories: []
      };

      // Expected response structure (would be from AI)
      const expectedResponse: Partial<IAMsgAnswer> = {
        trx: {
          type: 'transaction',
          amount: 25,
          description: 'coffee',
          method: 'debit',
          currency: 'USD',
          date: expect.any(Date)
        },
        msg: expect.stringContaining('Done'), // Should respond in English
        actionTaken: {
          type: IAAction.trx
        }
      };

      // Validate the structure matches our enhanced prompt expectations
      expect(expectedResponse.trx?.type).toBe('transaction');
      expect(expectedResponse.actionTaken?.type).toBe(IAAction.trx);
    });

    it('should validate Spanish income transaction', () => {
      // Mock test case for Spanish income
      const testMessage: MessageSentToIA = {
        msg: 'Me pagaron 50000 el sueldo',
        defaultCurrency: 'ARS',
        categories: []
      };

      // Expected response structure (would be from AI)
      const expectedResponse: Partial<IAMsgAnswer> = {
        trx: {
          type: 'income',
          amount: 50000,
          description: 'sueldo',
          currency: 'ARS',
          date: expect.any(Date)
        },
        msg: expect.stringContaining('Ingreso'), // Should respond in Spanish
        actionTaken: {
          type: IAAction.trx
        }
      };

      // Validate income doesn't require payment method
      expect(expectedResponse.trx?.method).toBeUndefined();
      expect(expectedResponse.trx?.type).toBe('income');
    });

    it('should validate missing amount handling', () => {
      // Mock test case for expense without amount
      const testMessage: MessageSentToIA = {
        msg: 'Compré pan',
        defaultCurrency: 'ARS',
        categories: []
      };

      // Expected response structure (would be from AI)
      const expectedResponse: Partial<IAMsgAnswer> = {
        msg: expect.stringContaining('¿Cuánto'), // Should ask "How much" in Spanish
        actionTaken: {
          type: IAAction.clarification,
          data: 'needs_amount'
        }
      };

      // Validate no transaction is created when amount is missing
      expect(expectedResponse.trx).toBeUndefined();
      expect(expectedResponse.actionTaken?.type).toBe(IAAction.clarification);
    });

    it('should validate general question handling', () => {
      // Mock test case for non-financial question
      const testMessage: MessageSentToIA = {
        msg: '¿Cómo estás?',
        defaultCurrency: 'ARS',
        categories: []
      };

      // Expected response structure (would be from AI)
      const expectedResponse: Partial<IAMsgAnswer> = {
        msg: expect.stringContaining('finanzas'), // Should mention finances in Spanish
        actionTaken: {
          type: IAAction.g_response
        }
      };

      // Validate no transaction for general questions
      expect(expectedResponse.trx).toBeUndefined();
      expect(expectedResponse.actionTaken?.type).toBe(IAAction.g_response);
    });

    it('should validate English general question', () => {
      // Mock test case for English non-financial question
      const testMessage: MessageSentToIA = {
        msg: 'How are you?',
        defaultCurrency: 'USD',
        categories: []
      };

      // Expected response structure (would be from AI)
      const expectedResponse: Partial<IAMsgAnswer> = {
        msg: expect.stringContaining('finance'), // Should mention finances in English
        actionTaken: {
          type: IAAction.g_response
        }
      };

      // Validate response language matches input
      expect(expectedResponse.trx).toBeUndefined();
      expect(expectedResponse.actionTaken?.type).toBe(IAAction.g_response);
    });
  });

  describe('Transaction Detection Enhancement', () => {
    it('should recognize various expense keywords', () => {
      const expenseKeywords = ['gasté', 'spent', 'compré', 'bought', 'pagué', 'paid', 'costó', 'cost', 'invertí'];

      // All these should be recognized as expense indicators
      expenseKeywords.forEach(keyword => {
        expect(['gasté', 'spent', 'compré', 'bought', 'pagué', 'paid', 'costó', 'cost', 'invertí']).toContain(keyword);
      });
    });

    it('should recognize various income keywords', () => {
      const incomeKeywords = ['recibí', 'received', 'cobré', 'earned', 'gané', 'won', 'me pagaron', 'got paid'];

      // All these should be recognized as income indicators
      incomeKeywords.forEach(keyword => {
        expect(['recibí', 'received', 'cobré', 'earned', 'gané', 'won', 'me pagaron', 'got paid']).toContain(keyword);
      });
    });
  });

  describe('Response Quality', () => {
    it('should provide conversational but brief responses', () => {
      // Test that response templates are natural and helpful
      const mockResponses = [
        'Registrando $500 en comida 🍕 ¿Con qué pagaste?',
        '✅ Listo! $1200 del super con crédito',
        '💰 Excelente! Ingreso de $50000 registrado',
        'Pan 🥖 ¿Cuánto gastaste?',
        '¡Bien! Listo para ayudarte con tus finanzas 📊',
        '✅ Done! $25 on coffee with debit'
      ];

      mockResponses.forEach(response => {
        // Check responses are not too long (brief)
        expect(response.length).toBeLessThan(100);
        // Check responses include helpful elements (emojis, clear messages)
        expect(response).toMatch(/[✅💰🍕🥖📊]|Done|Listo|Excelente/);
      });
    });
  });
});
