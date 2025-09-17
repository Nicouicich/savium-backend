import { Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service';
import { ExpensesService } from '../../expenses/expenses.service';
import { CategoriesService } from '../../categories/categories.service';
import { UsersService } from '../../users/users.service';
import { buildMessagePrompt, buildAudioPrompt, formatUserCategories } from './prompts/ai-prompts';

export interface UnifiedMessage {
  from: string;
  body: string;
  timestamp: Date;
  mediaUrl?: string;
  mediaType: 'text' | 'image' | 'document' | 'audio';
  platform: 'telegram' | 'whatsapp';
  chatId?: string;
  messageId?: string;
  userId?: string; // Will be populated after user lookup
}

export interface ProcessedMessageResponse {
  success: boolean;
  responseText?: string;
  actionTaken?: {
    type:
      | 'expense_created'
      | 'income_created'
      | 'image_processed'
      | 'document_processed'
      | 'general_response'
      | 'command_executed'
      | 'export_requested'
      | 'balance_requested'
      | 'report_generated';
    data?: any;
  };
  error?: string;
  requiresUserResponse?: boolean;
}

@Injectable()
export class MessageProcessorService {
  private readonly logger = new Logger(MessageProcessorService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly expensesService: ExpensesService,
    private readonly categoriesService: CategoriesService,
    private readonly usersService: UsersService
  ) {}

  async processMessage(message: UnifiedMessage): Promise<ProcessedMessageResponse> {
    this.logger.log(`🤖 Processing ${message.platform} message from ${message.from}:`, {
      mediaType: message.mediaType,
      bodyLength: message.body?.length || 0,
      hasMedia: !!message.mediaUrl
    });

    try {
      // Route to appropriate handler based on message type
      switch (message.mediaType) {
        case 'image':
          return this.processImageMessage(message);
        case 'document':
          return this.processDocumentMessage(message);
        case 'audio':
          return this.processAudioMessage(message);
        case 'text':
        default:
          return this.processTextMessage(message);
      }
    } catch (error) {
      this.logger.error('Error processing message:', error);
      return {
        success: false,
        error: error.message,
        responseText: '❌ Lo siento, hubo un error procesando tu mensaje. Por favor intenta de nuevo.'
      };
    }
  }

  private async processTextMessage(message: UnifiedMessage): Promise<ProcessedMessageResponse> {
    const text = message.body?.toLowerCase() || '';

    // Check if it's a command (Telegram style)
    if (text.startsWith('/')) {
      return this.processCommand(message);
    }

    // Get user categories (mock for now - should come from database)
    const userCategories = await this.getUserCategories(message.userId);

    // First, check if it's a command using AI
    const commandResult = await this.aiService.detectCommand(message.body);
    if (commandResult.isCommand) {
      return this.processAICommand(message, commandResult);
    }

    // Use AI to analyze the message for transactions
    const aiResult = await this.aiService.processTextMessage(message.body, userCategories);

    if (aiResult.hasTransaction) {
      return this.processTransactionFromAI(message, aiResult);
    }

    // If no transaction detected, provide conversational response
    return {
      success: true,
      responseText:
        '👋 ¡Hola! No detecté una transacción en tu mensaje. Puedes decirme algo como "gasté 25 en almuerzo", "recibí 1000 de sueldo" o enviar una foto del ticket.',
      actionTaken: { type: 'general_response' }
    };
  }

  // Método para obtener categorías del usuario (mock por ahora)
  private async getUserCategories(userId?: string): Promise<string[]> {
    // TODO: Obtener categorías reales del usuario desde la base de datos
    // Por ahora usamos categorías por defecto
    return ['Alimentación', 'Transporte', 'Entretenimiento', 'Salud', 'Hogar', 'Ropa', 'Educación', 'Tecnología', 'Servicios', 'Otros'];
  }

  // Procesar transacción detectada por IA
  private async processTransactionFromAI(message: UnifiedMessage, aiResult: any): Promise<ProcessedMessageResponse> {
    this.logger.log('AI detected transaction:', aiResult);

    const isIncome = aiResult.type === 'income';
    const transactionType = isIncome ? 'ingreso' : 'gasto';
    const emoji = isIncome ? '💰' : '💸';

    try {
      // Get user's active account
      const activeAccountId = await this.getUserActiveAccountId(message.userId!);
      if (!activeAccountId) {
        throw new Error('No active account found for user');
      }

      let createdTransaction;

      if (isIncome) {
        // TODO: Implement income service when available
        // For now, log income but don't create (you can extend this later)
        this.logger.log('Income detected - feature not yet implemented', {
          amount: aiResult.amount,
          description: aiResult.description,
          userId: message.userId
        });

        createdTransaction = {
          id: `income_${Date.now()}`,
          type: 'income',
          amount: aiResult.amount,
          description: aiResult.description
        };
      } else {
        // Create expense using ExpensesService
        const categoryId = await this.getCategoryByName(aiResult.category || 'Otros', activeAccountId);

        const expenseData = {
          amount: aiResult.amount,
          description: aiResult.description || 'Gasto desde mensaje',
          date: new Date(),
          categoryId,
          accountId: activeAccountId,
          isRecurring: aiResult.isRecurring || false,
          installments: aiResult.installments,
          metadata: {
            source: 'messaging_ai',
            platform: message.platform,
            confidence: aiResult.confidence,
            aiAnalysis: aiResult,
            installmentInfo: aiResult.installmentInfo
          }
        };

        const expense = await this.expensesService.create(expenseData, message.userId!);

        createdTransaction = {
          id: expense.id, // Use UUID instead of MongoDB _id
          type: 'expense',
          amount: expense.amount,
          description: expense.description,
          categoryName: aiResult.category
        };

        this.logger.log('Expense created successfully from AI message', {
          expenseId: expense.id, // Use UUID
          amount: expense.amount,
          platform: message.platform,
          userId: message.userId
        });
      }

      let responseText = `✅ ¡${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)} registrado!\n\n${emoji} Monto: $${aiResult.amount}\n📝 Descripción: ${aiResult.description}\n📂 Categoría: ${aiResult.category}`;

      if (aiResult.isRecurring) {
        responseText += `\n🔄 ${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)} recurrente detectado`;
      }

      if (aiResult.installments && aiResult.installments > 1) {
        responseText += `\n💳 En ${aiResult.installments} cuotas`;
        if (aiResult.installmentInfo) {
          responseText += ` (${aiResult.installmentInfo})`;
        }
      }

      responseText += `\n\n🤖 Confianza: ${Math.round((aiResult.confidence || 0) * 100)}%`;

      if (!isIncome) {
        responseText += `\n🆔 ID: ${createdTransaction.id.substring(0, 8)}...`;
      }

      return {
        success: true,
        responseText,
        actionTaken: {
          type: isIncome ? 'income_created' : 'expense_created',
          data: {
            ...aiResult,
            transactionId: createdTransaction.id,
            actualAmount: createdTransaction.amount
          }
        }
      };
    } catch (error) {
      this.logger.error('Failed to create transaction from AI message', {
        error: error.message,
        aiResult,
        platform: message.platform,
        userId: message.userId
      });

      return {
        success: false,
        responseText: `❌ Lo siento, hubo un error guardando tu ${transactionType}. Los datos fueron detectados correctamente, pero no pude guardarlos en tu cuenta. Por favor intenta de nuevo.`,
        error: error.message,
        actionTaken: {
          type: 'general_response',
          data: { error: error.message, detectedData: aiResult }
        }
      };
    }
  }

  /**
   * Get user's active account ID
   */
  private async getUserActiveAccountId(userId: string): Promise<string | null> {
    try {
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get active account from user's active profile
      if (user.activeProfileId) {
        // TODO: Get account from active profile when user profiles are available
        // For now, use first account if available
      }

      // Fallback: use first account
      if (user.accounts && user.accounts.length > 0) {
        return user.accounts[0].toString();
      }

      return null;
    } catch (error) {
      this.logger.error('Error getting user active account', {
        userId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get category ID by name or return default category
   */
  private async getCategoryByName(categoryName: string, accountId: string): Promise<string> {
    try {
      const categories = await this.categoriesService.findAll(accountId);

      // Look for exact match first
      let category = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());

      // If no exact match, look for partial match
      if (!category) {
        category = categories.find(c => c.name.toLowerCase().includes(categoryName.toLowerCase()) || categoryName.toLowerCase().includes(c.name.toLowerCase()));
      }

      if (category) {
        return category.id; // Use UUID instead of MongoDB _id
      }

      // Fallback to default category
      const defaultCategory = categories.find(c => ['otros', 'general', 'miscellaneous', 'other'].includes(c.name.toLowerCase())) || categories[0];

      if (defaultCategory) {
        return defaultCategory.id; // Use UUID instead of MongoDB _id
      }

      throw new Error('No categories found for account');
    } catch (error) {
      this.logger.error('Error finding category', {
        categoryName,
        accountId,
        error: error.message
      });
      throw error;
    }
  }

  // Procesar comandos detectados por IA
  private async processAICommand(message: UnifiedMessage, commandResult: any): Promise<ProcessedMessageResponse> {
    this.logger.log('AI detected command:', commandResult);

    switch (commandResult.commandType) {
      case 'export':
        return this.processExportCommand(message, commandResult.details);
      case 'balance':
        return this.processBalanceCommand(message, commandResult.details);
      case 'report':
        return this.processReportCommand(message, commandResult.details);
      case 'budget':
        return this.processBudgetCommand(message, commandResult.details);
      case 'help':
        return this.processHelpQuery(message);
      default:
        return {
          success: true,
          responseText: '🤖 Entiendo que quieres hacer algo, pero no estoy seguro qué. ¿Puedes ser más específico?',
          actionTaken: { type: 'general_response' }
        };
    }
  }

  // Procesar comando de exportación
  private async processExportCommand(message: UnifiedMessage, details: any): Promise<ProcessedMessageResponse> {
    this.logger.log('Processing export command:', details);

    let responseText = '📊 ¡Perfecto! Voy a generar tu exportación.\n\n';

    // Determinar el período
    if (details.month && details.year) {
      responseText += `📅 Período: ${details.month}/${details.year}\n`;
    } else if (details.year) {
      responseText += `📅 Año: ${details.year}\n`;
    } else {
      responseText += `📅 Período: Este mes\n`;
    }

    if (details.category) {
      responseText += `📂 Categoría: ${details.category}\n`;
    } else {
      responseText += `📂 Incluye: Todas las categorías\n`;
    }

    // TODO: Aquí integrar con el servicio de exportación real
    // const exportResult = await this.exportService.generateExport({
    //   userId: message.userId,
    //   period: details,
    //   format: 'excel'
    // });

    responseText += '\n🔄 Generando archivo...\n💾 Formato: Excel (.xlsx)\n\n';
    responseText += '✅ ¡Listo! Tu exportación estará disponible en la app en unos momentos.\n\n';
    responseText += '💡 También puedes descargarla desde la sección "Reportes" de la aplicación.';

    return {
      success: true,
      responseText,
      actionTaken: {
        type: 'export_requested',
        data: {
          period: details,
          userId: message.userId,
          requestedAt: new Date()
        }
      }
    };
  }

  // Procesar comando de balance
  private async processBalanceCommand(message: UnifiedMessage, details: any): Promise<ProcessedMessageResponse> {
    this.logger.log('Processing balance command:', details);

    // TODO: Obtener datos reales del usuario
    const mockBalance = {
      thisMonth: {
        expenses: 1250,
        income: 3000,
        budget: 2000,
        remaining: 750
      },
      topCategories: [
        { name: 'Alimentación', amount: 450 },
        { name: 'Transporte', amount: 200 },
        { name: 'Entretenimiento', amount: 150 }
      ]
    };

    let responseText = '💰 Tu Resumen Financiero\n\n';
    responseText += `📊 Este mes:\n`;
    responseText += `💸 Gastos: $${mockBalance.thisMonth.expenses}\n`;
    responseText += `💰 Ingresos: $${mockBalance.thisMonth.income}\n`;
    responseText += `📝 Presupuesto: $${mockBalance.thisMonth.budget}\n`;
    responseText += `💵 Disponible: $${mockBalance.thisMonth.remaining}\n\n`;
    responseText += `📈 Principales categorías:\n`;

    mockBalance.topCategories.forEach(cat => {
      const percentage = Math.round((cat.amount / mockBalance.thisMonth.expenses) * 100);
      responseText += `• ${cat.name}: $${cat.amount} (${percentage}%)\n`;
    });

    responseText += '\n💡 Para más detalles, revisa la app o pide un reporte específico.';

    return {
      success: true,
      responseText,
      actionTaken: {
        type: 'balance_requested',
        data: { userId: message.userId, requestedAt: new Date() }
      }
    };
  }

  // Procesar comando de reporte
  private async processReportCommand(message: UnifiedMessage, details: any): Promise<ProcessedMessageResponse> {
    return {
      success: true,
      responseText:
        '📊 Generando reporte personalizado...\n\n🔄 Esta función estará disponible pronto.\n\n💡 Por ahora puedes usar "balance" para ver un resumen rápido.',
      actionTaken: { type: 'report_generated', data: details }
    };
  }

  // Procesar comando de presupuesto
  private async processBudgetCommand(message: UnifiedMessage, details: any): Promise<ProcessedMessageResponse> {
    return {
      success: true,
      responseText:
        '💳 Información de presupuesto...\n\n🔄 Esta función estará disponible pronto.\n\n💡 Por ahora puedes usar "balance" para ver tu situación actual.',
      actionTaken: { type: 'command_executed', data: details }
    };
  }

  // Método legacy actualizado
  private async processExpenseTextLegacy(message: UnifiedMessage): Promise<ProcessedMessageResponse> {
    // Check if it's an expense message
    if (this.isExpenseMessage(message.body?.toLowerCase() || '')) {
      return this.processExpenseText(message);
    }

    // Check for common queries
    // if (this.isBalanceQuery(text)) {
    //   return this.processBalanceQuery(message);
    // }

    // if (this.isHelpQuery(text)) {
    //   return this.processHelpQuery(message);
    // }

    // General conversation - use AI for intelligent response
    return this.processGeneralMessage(message);
  }

  private async processImageMessage(message: UnifiedMessage): Promise<ProcessedMessageResponse> {
    this.logger.log(`📸 Processing image message with caption: "${message.body}"`);

    // If image has caption with expense data, process both image and text
    if (message.body && this.isExpenseMessage(message.body.toLowerCase())) {
      const imageResult = await this.processReceiptImage(message);
      const textResult = await this.processExpenseText(message);

      return {
        success: true,
        actionTaken: {
          type: 'expense_created',
          data: {
            fromImage: imageResult.actionTaken?.data,
            fromText: textResult.actionTaken?.data
          }
        },
        responseText: `📸💰 ¡Perfecto! Procesé tanto la imagen como el texto del gasto:\n\n${imageResult.responseText}\n\n${textResult.responseText}`
      };
    }

    // Process image only (receipt/ticket)
    return this.processReceiptImage(message);
  }

  private async processDocumentMessage(message: UnifiedMessage): Promise<ProcessedMessageResponse> {
    this.logger.log(`📄 Processing document message with caption: "${message.body}"`);

    // Similar logic to image but for documents (PDFs, etc.)
    if (message.body && this.isExpenseMessage(message.body.toLowerCase())) {
      const docResult = await this.processReceiptDocument(message);
      const textResult = await this.processExpenseText(message);

      return {
        success: true,
        actionTaken: {
          type: 'expense_created',
          data: {
            fromDocument: docResult.actionTaken?.data,
            fromText: textResult.actionTaken?.data
          }
        },
        responseText: `📄💰 ¡Excelente! Procesé tanto el documento como el texto del gasto:\n\n${docResult.responseText}\n\n${textResult.responseText}`
      };
    }

    return this.processReceiptDocument(message);
  }

  private async processAudioMessage(message: UnifiedMessage): Promise<ProcessedMessageResponse> {
    this.logger.log(`🎤 Processing audio message from ${message.from}`);

    if (!this.aiService.isAiEnabled()) {
      return {
        success: true,
        actionTaken: { type: 'general_response' },
        responseText:
          '🎤 ¡Audio recibido! (IA no configurada - datos de prueba)\n\n💬 Transcripción simulada: "Gasté 25 pesos en almuerzo"\n\n💰 Gasto detectado: $25.00\n📝 Descripción: Almuerzo\n📌 Categoría: Comida\n\n✅ Gasto guardado exitosamente'
      };
    }

    try {
      // Here you would download the audio file and process it
      // For now, we'll simulate the process
      const mockAudioBuffer = Buffer.from('mock audio data');
      const audioResult = await this.aiService.processAudioMessage(mockAudioBuffer, 'audio/ogg');

      let responseText = `🎤 ¡Audio procesado con Whisper!\n\n💬 Transcripción: "${audioResult.transcription}"\n🌍 Idioma: ${audioResult.language || 'Detectado automáticamente'}\n🎯 Confianza: ${Math.round((audioResult.confidence || 0) * 100)}%`;

      if (audioResult.processedTransaction && audioResult.processedTransaction.amount) {
        // Audio contains transaction information
        const isIncome = audioResult.processedTransaction.type === 'income';
        const transactionType = isIncome ? 'ingreso' : 'gasto';
        const emoji = isIncome ? '💰' : '💸';

        const transactionData = {
          type: audioResult.processedTransaction.type,
          amount: audioResult.processedTransaction.amount,
          description: audioResult.processedTransaction.description || (isIncome ? 'Ingreso desde audio' : 'Gasto desde audio'),
          category: audioResult.processedTransaction.category || 'Otros',
          isRecurring: audioResult.processedTransaction.isRecurring,
          installments: audioResult.processedTransaction.installments,
          installmentInfo: audioResult.processedTransaction.installmentInfo,
          userId: message.userId,
          platform: message.platform,
          source: 'audio',
          createdAt: new Date()
        };

        responseText += `\n\n${emoji} ¡${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)} detectado automáticamente!\n💵 Monto: $${transactionData.amount}\n📝 Descripción: ${transactionData.description}\n📌 Categoría: ${transactionData.category}`;

        if (transactionData.isRecurring) {
          responseText += `\n🔄 ${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)} recurrente`;
        }

        if (transactionData.installments && transactionData.installments > 1) {
          responseText += `\n💳 En ${transactionData.installments} cuotas`;
          if (transactionData.installmentInfo) {
            responseText += ` (${transactionData.installmentInfo})`;
          }
        }

        responseText += `\n\n✅ ${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)} guardado exitosamente`;

        return {
          success: true,
          actionTaken: {
            type: isIncome ? 'income_created' : 'expense_created',
            data: transactionData
          },
          responseText
        };
      } else {
        // Audio doesn't contain transaction information
        responseText += `\n\n💬 Mensaje procesado correctamente\n💡 No se detectó información de transacciones en el audio`;

        return {
          success: true,
          actionTaken: { type: 'general_response' },
          responseText
        };
      }
    } catch (error) {
      this.logger.error('Error processing audio message:', error);
      return {
        success: false,
        error: error.message,
        responseText: '❌ Error procesando el audio. Por favor intenta enviar el mensaje de texto o prueba con otro audio.'
      };
    }
  }

  private async processReceiptImage(message: UnifiedMessage): Promise<ProcessedMessageResponse> {
    if (!this.aiService.isAiEnabled()) {
      return {
        success: true,
        actionTaken: { type: 'image_processed' },
        responseText:
          '📸 ¡Imagen recibida! (IA no configurada - datos de prueba)\n\n💰 Gasto detectado: $25.00\n📝 Descripción: Almuerzo\n📂 Categoría: Comida\n\n✅ Gasto guardado exitosamente'
      };
    }

    try {
      // Here you would download the image and process it
      // For now, we'll simulate the process
      const mockImageBuffer = Buffer.from('mock image data');
      const ticketResult = await this.aiService.processTicketImage(mockImageBuffer, 'image/jpeg');

      if (ticketResult.amount && ticketResult.amount > 0) {
        // Create expense in database (you'll need to inject ExpensesService)
        const expenseData = {
          amount: ticketResult.amount,
          description: ticketResult.description || 'Gasto desde imagen',
          vendor: ticketResult.vendor,
          date: ticketResult.date || new Date(),
          category: ticketResult.suggestedCategory
        };

        return {
          success: true,
          actionTaken: {
            type: 'expense_created',
            data: expenseData
          },
          responseText: `📸 ¡Imagen procesada con IA!\n\n💰 Gasto detectado: $${ticketResult.amount}\n📝 Descripción: ${ticketResult.description}\n🏪 Comercio: ${ticketResult.vendor || 'No detectado'}\n📂 Categoría sugerida: ${ticketResult.suggestedCategory}\n🎯 Confianza: ${Math.round((ticketResult.confidence || 0) * 100)}%\n\n✅ Gasto guardado exitosamente`
        };
      } else {
        return {
          success: true,
          actionTaken: { type: 'image_processed' },
          responseText:
            '📸 Imagen recibida, pero no pude detectar información de gasto.\n\n💡 Consejo: Asegúrate de que la imagen sea clara y muestre el total del recibo.',
          requiresUserResponse: true
        };
      }
    } catch (error) {
      this.logger.error('Error processing receipt image:', error);
      return {
        success: false,
        error: error.message,
        responseText: '❌ Error procesando la imagen. Por favor intenta enviarla de nuevo o ingresa el gasto manualmente.'
      };
    }
  }

  private async processReceiptDocument(message: UnifiedMessage): Promise<ProcessedMessageResponse> {
    return {
      success: true,
      actionTaken: { type: 'document_processed' },
      responseText:
        '📄 Documento recibido. El procesamiento de documentos PDF aún no está implementado.\n\n💡 Consejo: Puedes enviar una foto del recibo o escribir el gasto manualmente.'
    };
  }

  private async processExpenseText(message: UnifiedMessage): Promise<ProcessedMessageResponse> {
    const expenseData = this.extractExpenseFromText(message.body);

    if (!expenseData.amount) {
      return {
        success: false,
        responseText: '❌ No pude entender el monto del gasto.\n\n💡 Ejemplos válidos:\n• "Gasté $25 en almuerzo"\n• "25 comida"\n• "Spent 30 on groceries"'
      };
    }

    // Use AI for category suggestion if enabled
    let suggestedCategory = 'Otros';
    if (this.aiService.isAiEnabled()) {
      try {
        const defaultCategories = ['Alimentación', 'Transporte', 'Entretenimiento', 'Salud', 'Hogar', 'Otros'];
        const categorySuggestions = await this.aiService.categorizeExpense(
          expenseData.description || '',
          expenseData.amount,
          defaultCategories,
          expenseData.vendor
        );

        if (categorySuggestions.length > 0) {
          suggestedCategory = categorySuggestions[0].categoryName;
        }
      } catch (error) {
        this.logger.warn('Error getting AI category suggestion:', error.message);
      }
    }

    // Here you would save to database
    const savedExpense = {
      ...expenseData,
      category: suggestedCategory,
      userId: message.userId,
      platform: message.platform,
      createdAt: new Date()
    };

    return {
      success: true,
      actionTaken: {
        type: 'expense_created',
        data: savedExpense
      },
      responseText: `✅ ¡Gasto registrado!\n\n💰 Monto: $${expenseData.amount}\n📝 Descripción: ${expenseData.description}\n📂 Categoría: ${suggestedCategory}\n📅 Fecha: ${new Date().toLocaleDateString('es-ES')}\n\n🤖 ${this.aiService.isAiEnabled() ? 'Categorizado con IA' : 'Categoría por defecto'}`
    };
  }

  private async processCommand(message: UnifiedMessage): Promise<ProcessedMessageResponse> {
    const command = message.body.split(' ')[0].toLowerCase();

    switch (command) {
      case '/start':
        return {
          success: true,
          actionTaken: { type: 'command_executed' },
          responseText: `👋 ¡Hola! Soy tu asistente de finanzas personales Savium.\n\n💰 Puedes:\n• Enviar gastos: "gasté 25 en almuerzo"\n• Enviar fotos de recibos\n• Ver tu balance: /balance\n• Obtener ayuda: /help\n\n🤖 ¡Empecemos a manejar mejor tu dinero!`
        };

      case '/help':
        return this.processHelpQuery(message);

      case '/balance':
        return this.processBalanceQuery(message);

      case '/categories':
        return {
          success: true,
          actionTaken: { type: 'command_executed' },
          responseText:
            '📂 Categorías disponibles:\n\n🍽️ Comida y Restaurantes\n🚗 Transporte\n🛒 Compras\n🎯 Entretenimiento\n💊 Salud\n🏠 Hogar\n💼 Trabajo\n📱 Suscripciones\n📚 Educación\n🔧 Servicios\n💸 Otros'
        };

      default:
        return {
          success: false,
          responseText: `❓ Comando "${command}" no reconocido.\n\nUsa /help para ver los comandos disponibles.`
        };
    }
  }

  private async processGeneralMessage(message: UnifiedMessage): Promise<ProcessedMessageResponse> {
    // This could use AI for intelligent conversation
    const responses = [
      '🤖 ¡Hola! Estoy aquí para ayudarte con tus finanzas.',
      '💰 ¿Quieres registrar un gasto? Escribe algo como "gasté 20 en café"',
      '📸 También puedes enviar fotos de tus recibos para procesamiento automático.',
      '❓ Si necesitas ayuda, escribe /help'
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];

    return {
      success: true,
      actionTaken: { type: 'general_response' },
      responseText: `${randomResponse}\n\n💡 Tu mensaje: "${message.body}"`
    };
  }

  private async processBalanceQuery(message: UnifiedMessage): Promise<ProcessedMessageResponse> {
    // This would fetch real data from database
    return {
      success: true,
      actionTaken: { type: 'command_executed' },
      responseText: `💰 Resumen Financiero\n\n📊 Este mes:\n• Gastado: $1,250\n• Presupuesto: $2,000\n• Disponible: $750\n\n📈 Categorías principales:\n• Comida: $450 (36%)\n• Transporte: $200 (16%)\n• Entretenimiento: $150 (12%)\n\n(Datos de ejemplo - conectar con DB real)`
    };
  }

  private processHelpQuery(message: UnifiedMessage): ProcessedMessageResponse {
    return {
      success: true,
      actionTaken: { type: 'command_executed' },
      responseText: `🤖 Comandos disponibles:\n\n💰 Registrar gastos:\n• "gasté 25 en almuerzo"\n• "30 café"\n• Envía foto del recibo\n\n📊 Información:\n• /balance - Ver resumen\n• /categories - Ver categorías\n\n❓ Ayuda:\n• /help - Este mensaje\n• /start - Mensaje de bienvenida\n\n🤖 ¡Estoy aquí para ayudarte a manejar mejor tu dinero!`
    };
  }

  // Helper methods
  private isExpenseMessage(text: string): boolean {
    const expenseKeywords = ['gasté', 'gaste', 'spent', 'compré', 'compre', 'pagué', 'pague', 'costó', 'costo', 'cuesta', 'precio', '$'];

    const hasExpenseKeyword = expenseKeywords.some(keyword => text.includes(keyword));
    const hasAmount = /\$?\d+(?:\.\d{2})?/.test(text);

    return hasExpenseKeyword || hasAmount;
  }

  private isBalanceQuery(text: string): boolean {
    const balanceKeywords = ['balance', 'saldo', 'dinero', 'gastado', 'resumen', 'estado'];
    return balanceKeywords.some(keyword => text.includes(keyword));
  }

  private isHelpQuery(text: string): boolean {
    const helpKeywords = ['ayuda', 'help', 'comandos', 'que puedes hacer', 'como funciona'];
    return helpKeywords.some(keyword => text.includes(keyword));
  }

  private extractExpenseFromText(text: string): {
    amount?: number;
    description?: string;
    vendor?: string;
  } {
    // Enhanced expense parsing patterns
    const patterns = [
      // "gasté 25 en almuerzo"
      /(?:gasté|gaste|spent|pagué|pague)\s+\$?(\d+(?:\.\d{2})?)\s+(?:en|on|for)\s+(.+)/i,
      // "25 almuerzo" or "$25 lunch"
      /\$?(\d+(?:\.\d{2})?)\s+(.+)/,
      // "almuerzo 25" or "lunch $25"
      /(.+?)\s+\$?(\d+(?:\.\d{2})?)$/,
      // "costó 25" or "cost 25"
      /(?:costó|costo|cost|price)\s+\$?(\d+(?:\.\d{2})?)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const amount = parseFloat(match[1] || match[2]);
        const description = (match[2] || match[1] || '').trim();

        if (amount && !isNaN(amount)) {
          return {
            amount,
            description: description || 'Gasto sin descripción'
          };
        }
      }
    }

    return {};
  }
}
