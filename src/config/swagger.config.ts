import {registerAs} from '@nestjs/config';

export default registerAs('swagger', () => ({
  title: process.env.SWAGGER_TITLE || 'Savium AI API',
  description: process.env.SWAGGER_DESCRIPTION || 'Complete API for Savium AI financial management platform',
  version: process.env.SWAGGER_VERSION || '1.0.0',
  path: process.env.SWAGGER_PATH || 'api/docs',

  // Tags configuration
  tags: [
    {name: 'Auth', description: 'Authentication and authorization endpoints'},
    {name: 'Users', description: 'User management operations'},
    {
      name: 'Accounts',
      description: 'Account management for personal, couple, family, and business'
    },
    {name: 'Expenses', description: 'Expense tracking and management'},
    {name: 'Categories', description: 'Expense categorization'},
    {name: 'Reports', description: 'Financial reports and analytics'},
    {name: 'Budgets', description: 'Budget management'},
    {name: 'Goals', description: 'Financial goals and targets'},
    {
      name: 'Integrations',
      description: 'External service integrations (AI, WhatsApp, Telegram)'
    },
    {name: 'Health', description: 'Application health and monitoring'}
  ],

  // Server configuration
  servers: [
    {
      url: process.env.APP_URL || 'http://localhost:3000',
      description: 'Development server'
    }
  ],

  // Security schemes
  security: {
    bearer: {
      type: 'http' as const,
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'JWT Authorization header using the Bearer scheme'
    }
  }
}));
