import {BadRequestException, Controller, Delete, Get, Param, Post, Query, UseGuards} from '@nestjs/common';
import {ApiOperation, ApiQuery, ApiResponse, ApiTags} from '@nestjs/swagger';
import {ReportsService} from './reports.service';
import {CategoryReportDto, ExportFormat, ExportReportDto, MonthlyReportDto, ReportPeriod, ReportQueryDto, ReportType, SummaryReportDto} from './dto';
import {JwtAuthGuard} from '@common/guards/jwt-auth.guard';
import {CurrentUser} from '@common/decorators/current-user.decorator';
import {ApiResponseDecorator} from '@common/decorators/api-response.decorator';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('monthly')
  @ApiOperation({
    summary: 'Generate monthly report',
    description: 'Generate a detailed monthly spending report for the specified account and period'
  })
  @ApiQuery({
    name: 'accountId',
    required: true,
    type: String,
    description: 'Account ID'
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ReportPeriod,
    description: 'Report period'
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Custom start date (YYYY-MM-DD)'
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Custom end date (YYYY-MM-DD)'
  })
  @ApiQuery({
    name: 'currency',
    required: false,
    type: String,
    description: 'Currency code'
  })
  @ApiQuery({
    name: 'includeComparison',
    required: false,
    type: Boolean,
    description: 'Include comparison with previous period'
  })
  @ApiResponseDecorator(MonthlyReportDto, 200, 'Monthly report generated successfully')
  async getMonthlyReport(@Query() query: ReportQueryDto, @CurrentUser() user: any): Promise<MonthlyReportDto> {
    if (!query.accountId) {
      throw new BadRequestException('Account ID is required');
    }

    // Set default values
    const reportQuery = {
      ...query,
      type: ReportType.MONTHLY,
      period: query.period || ReportPeriod.LAST_MONTH
    };

    return this.reportsService.generateMonthlyReport(reportQuery, user.id);
  }

  @Get('category')
  @ApiOperation({
    summary: 'Generate category report',
    description: 'Generate a detailed category spending analysis report'
  })
  @ApiQuery({
    name: 'accountId',
    required: true,
    type: String,
    description: 'Account ID'
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ReportPeriod,
    description: 'Report period'
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Custom start date (YYYY-MM-DD)'
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Custom end date (YYYY-MM-DD)'
  })
  @ApiQuery({
    name: 'categoryIds',
    required: false,
    type: [String],
    description: 'Filter by specific categories'
  })
  @ApiQuery({
    name: 'months',
    required: false,
    type: Number,
    description: 'Number of months for trends analysis'
  })
  @ApiQuery({
    name: 'currency',
    required: false,
    type: String,
    description: 'Currency code'
  })
  @ApiQuery({
    name: 'includeComparison',
    required: false,
    type: Boolean,
    description: 'Include comparison with previous period'
  })
  @ApiResponseDecorator(CategoryReportDto, 200, 'Category report generated successfully')
  async getCategoryReport(@Query() query: ReportQueryDto, @CurrentUser() user: any): Promise<CategoryReportDto> {
    if (!query.accountId) {
      throw new BadRequestException('Account ID is required');
    }

    const reportQuery = {
      ...query,
      type: ReportType.CATEGORY,
      period: query.period || ReportPeriod.LAST_3_MONTHS,
      months: query.months || 6
    };

    return this.reportsService.generateCategoryReport(reportQuery, user.id);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Generate summary report',
    description: 'Generate a comprehensive summary report with insights and recommendations'
  })
  @ApiQuery({
    name: 'accountId',
    required: true,
    type: String,
    description: 'Account ID'
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ReportPeriod,
    description: 'Report period'
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Custom start date (YYYY-MM-DD)'
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Custom end date (YYYY-MM-DD)'
  })
  @ApiQuery({
    name: 'months',
    required: false,
    type: Number,
    description: 'Number of months for trends analysis'
  })
  @ApiQuery({
    name: 'currency',
    required: false,
    type: String,
    description: 'Currency code'
  })
  @ApiQuery({
    name: 'includeComparison',
    required: false,
    type: Boolean,
    description: 'Include comparison with previous period'
  })
  @ApiQuery({
    name: 'groupByUser',
    required: false,
    type: Boolean,
    description: 'Group expenses by user (for shared accounts)'
  })
  @ApiResponseDecorator(SummaryReportDto, 200, 'Summary report generated successfully')
  async getSummaryReport(@Query() query: ReportQueryDto, @CurrentUser() user: any): Promise<SummaryReportDto> {
    if (!query.accountId) {
      throw new BadRequestException('Account ID is required');
    }

    const reportQuery = {
      ...query,
      type: ReportType.SUMMARY,
      period: query.period || ReportPeriod.LAST_3_MONTHS,
      months: query.months || 12,
      includeComparison: query.includeComparison !== false // Default to true
    };

    return this.reportsService.generateSummaryReport(reportQuery, user.id);
  }

  @Post('export')
  @ApiOperation({
    summary: 'Export report',
    description: 'Export a report in the specified format (PDF, CSV, Excel, JSON)'
  })
  @ApiResponseDecorator(ExportReportDto, 201, 'Report export initiated successfully')
  async exportReport(@Query() query: ReportQueryDto, @CurrentUser() user: any): Promise<ExportReportDto> {
    if (!query.accountId) {
      throw new BadRequestException('Account ID is required');
    }

    if (!query.type) {
      throw new BadRequestException('Report type is required for export');
    }

    if (!query.format) {
      throw new BadRequestException('Export format is required');
    }

    const reportQuery = {
      ...query,
      period: query.period || ReportPeriod.LAST_MONTH
    };

    return this.reportsService.exportReport(reportQuery, user.id);
  }

  @Get('download/:token')
  @ApiOperation({
    summary: 'Download exported report',
    description: 'Download a previously exported report using the download token'
  })
  @ApiResponse({status: 200, description: 'File download successful'})
  @ApiResponse({status: 404, description: 'Export not found or expired'})
  async downloadReport(@Param('token') token: string, @CurrentUser() user: any) {
    // This would implement the actual file download logic
    // For now, we'll return a placeholder response
    return {
      message: 'File download would be handled here',
      token,
      note: 'In a real implementation, this would serve the actual file'
    };
  }

  @Delete('cache')
  @ApiOperation({
    summary: 'Clear reports cache',
    description: 'Clear cached reports for better performance or when data has changed significantly'
  })
  @ApiQuery({
    name: 'accountId',
    required: false,
    type: String,
    description: 'Clear cache for specific account only'
  })
  @ApiResponse({status: 200, description: 'Cache cleared successfully'})
  async clearCache(@Query('accountId') accountId?: string, @CurrentUser() user?: any) {
    // In a real implementation, you might want to restrict this to account admins
    await this.reportsService.clearReportsCache(accountId);

    return {
      message: accountId ? `Cache cleared for account ${accountId}` : 'All reports cache cleared',
      clearedAt: new Date()
    };
  }

  @Get('formats')
  @ApiOperation({
    summary: 'Get available export formats',
    description: 'Get list of available export formats and their descriptions'
  })
  @ApiResponse({
    status: 200,
    description: 'Export formats retrieved successfully'
  })
  async getAvailableFormats() {
    return {
      formats: [
        {
          format: ExportFormat.PDF,
          name: 'PDF',
          description: 'Formatted PDF document suitable for printing and sharing',
          mimeType: 'application/pdf'
        },
        {
          format: ExportFormat.CSV,
          name: 'CSV',
          description: 'Comma-separated values file for spreadsheet applications',
          mimeType: 'text/csv'
        },
        {
          format: ExportFormat.EXCEL,
          name: 'Excel',
          description: 'Microsoft Excel workbook with multiple sheets',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        },
        {
          format: ExportFormat.JSON,
          name: 'JSON',
          description: 'Machine-readable JSON format for developers',
          mimeType: 'application/json'
        }
      ]
    };
  }

  @Get('periods')
  @ApiOperation({
    summary: 'Get available report periods',
    description: 'Get list of predefined report periods'
  })
  @ApiResponse({
    status: 200,
    description: 'Report periods retrieved successfully'
  })
  async getAvailablePeriods() {
    return {
      periods: [
        {
          period: ReportPeriod.LAST_MONTH,
          name: 'Last Month',
          description: 'Previous calendar month'
        },
        {
          period: ReportPeriod.LAST_3_MONTHS,
          name: 'Last 3 Months',
          description: 'Previous 3 months from today'
        },
        {
          period: ReportPeriod.LAST_6_MONTHS,
          name: 'Last 6 Months',
          description: 'Previous 6 months from today'
        },
        {
          period: ReportPeriod.LAST_YEAR,
          name: 'Last Year',
          description: 'Previous 12 months from today'
        },
        {
          period: ReportPeriod.CUSTOM,
          name: 'Custom Period',
          description: 'Define custom start and end dates'
        }
      ]
    };
  }
}
