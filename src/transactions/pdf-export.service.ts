import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { TransactionDocument } from './schemas/transaction.schema';
import { TransactionExportDto, ExportPeriod } from './dto/transaction-export.dto';
import { Currency } from '@common/constants/transaction-categories';

interface ExportData {
  transactions: TransactionDocument[];
  summary: {
    totalAmount: number;
    totalTransactions: number;
    averageAmount: number;
    currency: Currency;
    period: string;
    dateRange: string;
  };
  categoryBreakdown?: Array<{
    categoryName: string;
    totalAmount: number;
    transactionCount: number;
    percentage: number;
  }>;
  monthlyTrends?: Array<{
    year: number;
    month: number;
    totalAmount: number;
    transactionCount: number;
  }>;
  profileInfo: {
    id: string;
    name: string;
    type: string;
  };
}

@Injectable()
export class PdfExportService {
  private readonly logger = new Logger(PdfExportService.name);

  async generateTransactionsPdf(data: ExportData, options: TransactionExportDto): Promise<Buffer> {
    let browser: puppeteer.Browser | null = null;

    try {
      this.logger.log(`Generating PDF export for profile ${data.profileInfo.id} with ${data.transactions.length} transactions`);

      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 800 });

      const html = this.generateHtmlTemplate(data, options);
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: this.getHeaderTemplate(data.profileInfo),
        footerTemplate: this.getFooterTemplate()
      });

      this.logger.log(`PDF generated successfully for profile ${data.profileInfo.id}`);
      return Buffer.from(pdfBuffer);
    } catch (error) {
      this.logger.error('Error generating PDF:', error);
      throw new BadRequestException(`Failed to generate PDF: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private generateHtmlTemplate(data: ExportData, options: TransactionExportDto): string {
    const styles = this.getCssStyles();
    const summarySection = options.includeSummary ? this.generateSummarySection(data.summary) : '';
    const categorySection = options.includeCategoryBreakdown && data.categoryBreakdown ? this.generateCategoryBreakdownSection(data.categoryBreakdown) : '';
    const trendsSection = options.includeMonthlyTrends && data.monthlyTrends ? this.generateMonthlyTrendsSection(data.monthlyTrends) : '';
    const transactionsSection = this.generateTransactionsSection(data.transactions, options);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Reporte de Gastos - ${data.profileInfo.name}</title>
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reporte de Gastos</h1>
            <div class="account-info">
              <h2>${data.profileInfo.name}</h2>
              <p>Período: ${data.summary.dateRange}</p>
              <p>Generado el: ${new Date().toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
            </div>
          </div>

          ${summarySection}
          ${categorySection}
          ${trendsSection}
          ${transactionsSection}
        </div>
      </body>
      </html>
    `;
  }

  private generateSummarySection(summary: any): string {
    return `
      <div class="summary-section">
        <h3>Resumen General</h3>
        <div class="summary-cards">
          <div class="summary-card">
            <h4>Total Gastado</h4>
            <p class="amount">${this.formatCurrency(summary.totalAmount, summary.currency)}</p>
          </div>
          <div class="summary-card">
            <h4>Total de Gastos</h4>
            <p class="count">${summary.totalTransactions}</p>
          </div>
          <div class="summary-card">
            <h4>Promedio por Gasto</h4>
            <p class="amount">${this.formatCurrency(summary.averageAmount, summary.currency)}</p>
          </div>
        </div>
      </div>
    `;
  }

  private generateCategoryBreakdownSection(breakdown: any[]): string {
    const rows = breakdown
      .map(
        item => `
      <tr>
        <td>${item.categoryName}</td>
        <td class="amount">${this.formatCurrency(item.totalAmount, Currency.USD)}</td>
        <td class="center">${item.transactionCount}</td>
        <td class="center">${item.percentage.toFixed(1)}%</td>
      </tr>
    `
      )
      .join('');

    return `
      <div class="breakdown-section">
        <h3>Desglose por Categorías</h3>
        <table class="breakdown-table">
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Total</th>
              <th>Cantidad</th>
              <th>Porcentaje</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  private generateMonthlyTrendsSection(trends: any[]): string {
    const rows = trends
      .map(
        trend => `
      <tr>
        <td>${this.getMonthName(trend.month)} ${trend.year}</td>
        <td class="amount">${this.formatCurrency(trend.totalAmount, Currency.USD)}</td>
        <td class="center">${trend.transactionCount}</td>
      </tr>
    `
      )
      .join('');

    return `
      <div class="trends-section">
        <h3>Tendencias Mensuales</h3>
        <table class="trends-table">
          <thead>
            <tr>
              <th>Mes</th>
              <th>Total</th>
              <th>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  private generateTransactionsSection(transactions: TransactionDocument[], options: TransactionExportDto): string {
    if (options.groupByCategory) {
      return this.generateGroupedTransactionsSection(transactions);
    }

    const rows = transactions
      .map(
        transaction => `
      <tr>
        <td>${new Date(transaction.date).toLocaleDateString('es-ES')}</td>
        <td>${transaction.description}</td>
        <td>${transaction.vendor || '-'}</td>
        <td>${transaction.categoryId || '-'}</td>
        <td class="amount">${this.formatCurrency(transaction.amount, transaction.currency)}</td>
        <td>${transaction.paymentMethod || '-'}</td>
      </tr>
    `
      )
      .join('');

    return `
      <div class="transactions-section">
        <h3>Detalle de Gastos</h3>
        <table class="transactions-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Descripción</th>
              <th>Comercio</th>
              <th>Categoría</th>
              <th>Monto</th>
              <th>Método de Pago</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  private generateGroupedTransactionsSection(transactions: TransactionDocument[]): string {
    const grouped = transactions.reduce(
      (acc, transaction) => {
        const categoryId = transaction.categoryId?.toString() || 'Sin categoría';
        if (!acc[categoryId]) {
          acc[categoryId] = [];
        }
        acc[categoryId].push(transaction);
        return acc;
      },
      {} as Record<string, TransactionDocument[]>
    );

    const sections = Object.entries(grouped)
      .map(([categoryId, categoryTransactions]) => {
        const categoryTotal = categoryTransactions.reduce((sum, exp) => sum + exp.amount, 0);
        const rows = categoryTransactions
          .map(
            transaction => `
        <tr>
          <td>${new Date(transaction.date).toLocaleDateString('es-ES')}</td>
          <td>${transaction.description}</td>
          <td>${transaction.vendor || '-'}</td>
          <td class="amount">${this.formatCurrency(transaction.amount, transaction.currency)}</td>
          <td>${transaction.paymentMethod || '-'}</td>
        </tr>
      `
          )
          .join('');

        return `
        <div class="category-group">
          <h4>${categoryId} - Total: ${this.formatCurrency(categoryTotal, Currency.USD)} (${categoryTransactions.length} gastos)</h4>
          <table class="transactions-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Comercio</th>
                <th>Monto</th>
                <th>Método de Pago</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
      })
      .join('');

    return `
      <div class="transactions-section">
        <h3>Gastos por Categoría</h3>
        ${sections}
      </div>
    `;
  }

  private getCssStyles(): string {
    return `
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Arial', sans-serif;
          font-size: 12px;
          line-height: 1.4;
          color: #333;
          background: #fff;
        }

        .container {
          width: 100%;
          max-width: 210mm;
          margin: 0 auto;
          padding: 20px;
        }

        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #2c3e50;
          padding-bottom: 20px;
        }

        .header h1 {
          color: #2c3e50;
          font-size: 24px;
          margin-bottom: 10px;
        }

        .account-info h2 {
          color: #34495e;
          font-size: 18px;
          margin-bottom: 5px;
        }

        .account-info p {
          color: #7f8c8d;
          font-size: 11px;
        }

        .summary-section {
          margin-bottom: 25px;
        }

        .summary-section h3,
        .breakdown-section h3,
        .trends-section h3,
        .transactions-section h3 {
          color: #2c3e50;
          font-size: 16px;
          margin-bottom: 15px;
          border-bottom: 1px solid #ecf0f1;
          padding-bottom: 5px;
        }

        .summary-cards {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 20px;
        }

        .summary-card {
          flex: 1;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 6px;
          padding: 15px;
          text-align: center;
        }

        .summary-card h4 {
          color: #495057;
          font-size: 12px;
          margin-bottom: 8px;
          font-weight: 600;
        }

        .summary-card .amount {
          color: #28a745;
          font-size: 16px;
          font-weight: bold;
        }

        .summary-card .count {
          color: #007bff;
          font-size: 16px;
          font-weight: bold;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 11px;
        }

        th, td {
          padding: 8px;
          text-align: left;
          border-bottom: 1px solid #dee2e6;
        }

        th {
          background-color: #f8f9fa;
          font-weight: 600;
          color: #495057;
          border-bottom: 2px solid #dee2e6;
        }

        .amount {
          text-align: right;
          font-weight: 500;
          color: #28a745;
        }

        .center {
          text-align: center;
        }

        .breakdown-section,
        .trends-section,
        .transactions-section {
          margin-bottom: 25px;
        }

        .category-group {
          margin-bottom: 20px;
          border: 1px solid #e9ecef;
          border-radius: 6px;
          overflow: hidden;
        }

        .category-group h4 {
          background: #f8f9fa;
          padding: 12px 15px;
          margin: 0;
          color: #495057;
          font-size: 13px;
          border-bottom: 1px solid #e9ecef;
        }

        .category-group table {
          margin: 0;
        }

        .category-group th {
          background: #fff;
        }

        tr:nth-child(even) {
          background-color: #f8f9fa;
        }

        tr:hover {
          background-color: #e9ecef;
        }

        @media print {
          .container {
            padding: 0;
          }

          .category-group {
            break-inside: avoid;
          }

          table {
            page-break-inside: auto;
          }

          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      </style>
    `;
  }

  private getHeaderTemplate(profileInfo: any): string {
    return `
      <div style="font-size: 10px; color: #666; width: 100%; text-align: center; margin-top: 10px;">
        <span>Savium - Reporte de Gastos - ${profileInfo.name}</span>
      </div>
    `;
  }

  private getFooterTemplate(): string {
    return `
      <div style="font-size: 10px; color: #666; width: 100%; text-align: center; margin-bottom: 10px;">
        <span class="pageNumber"></span> de <span class="totalPages"></span> - Generado por Savium
      </div>
    `;
  }

  private formatCurrency(amount: number, currency: Currency): string {
    const currencySymbols = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      ARS: '$',
      CLP: '$',
      COP: '$',
      MXN: '$',
      PEN: 'S/',
      BRL: 'R$'
    };

    const symbol = currencySymbols[currency] || currency;
    return `${symbol}${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private getMonthName(month: number): string {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return months[month - 1] || 'Mes desconocido';
  }

  calculateDateRange(period: ExportPeriod, startDate?: Date, endDate?: Date): { start: Date; end: Date; description: string } {
    const now = new Date();

    switch (period) {
      case ExportPeriod.CURRENT_MONTH:
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return {
          start: currentMonthStart,
          end: currentMonthEnd,
          description: `${this.getMonthName(now.getMonth() + 1)} ${now.getFullYear()}`
        };

      case ExportPeriod.LAST_MONTH:
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
          start: lastMonthStart,
          end: lastMonthEnd,
          description: `${this.getMonthName(lastMonthStart.getMonth() + 1)} ${lastMonthStart.getFullYear()}`
        };

      case ExportPeriod.LAST_3_MONTHS:
        const last3MonthsStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        return {
          start: last3MonthsStart,
          end: now,
          description: 'Últimos 3 meses'
        };

      case ExportPeriod.LAST_6_MONTHS:
        const last6MonthsStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        return {
          start: last6MonthsStart,
          end: now,
          description: 'Últimos 6 meses'
        };

      case ExportPeriod.CURRENT_YEAR:
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const yearEnd = new Date(now.getFullYear(), 11, 31);
        return {
          start: yearStart,
          end: yearEnd,
          description: `Año ${now.getFullYear()}`
        };

      case ExportPeriod.CUSTOM:
        if (!startDate || !endDate) {
          throw new BadRequestException('Start date and end date are required for custom period');
        }
        return {
          start: startDate,
          end: endDate,
          description: `${startDate.toLocaleDateString('es-ES')} - ${endDate.toLocaleDateString('es-ES')}`
        };

      default:
        throw new BadRequestException('Invalid export period');
    }
  }
}
