import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/authMiddleware';
import { tenantContextMiddleware } from '../middleware/tenantContextMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireTier } from '../middleware/tierEnforcementMiddleware';
import * as reportingService from '../services/reportingService';
import { ReportingServiceError } from '../services/reportingService';
import { requireTenantContext } from '../context/tenantContext';
import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { generateBalanceSheetPdf, generateProfitAndLossPdf, generateCashFlowPdf } from '../services/pdfGenerationService';
import { generateBalanceSheetDocx, generateProfitAndLossDocx, generateCashFlowDocx } from '../services/reportDocxService';
import * as cashFlowForecastService from '../services/cashFlowForecastService';
import { CashFlowForecastServiceError } from '../services/cashFlowForecastService';
import * as agingReportService from '../services/agingReportService';
import { getCachedReport, setCachedReport } from '../cache/reportCache';
import * as monthlySalesLedgerService from '../services/monthlySalesLedgerService';

const router = Router();

async function resolveTenantDisplayInfo(tenantId: string, tenantName: string | undefined): Promise<{ name: string; currency: string }> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { baseCurrency: true } });
  return { name: tenantName || 'Business', currency: tenant?.baseCurrency || 'USD' };
}

// Enforce authentication & tenant context on all reports endpoints
router.use(authenticateJwt);
router.use(tenantContextMiddleware);

/**
 * GET /api/v1/reports/trial-balance
 * Description: Trial Balance report listing accounts with Debit/Credit balances verifying total debits == total credits.
 * Access: Viewer role or higher
 */
router.get('/trial-balance', requireTier(2, 'Trial Balance'), requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { startDate, endDate, asOfDate } = req.query;
    const params = { startDate: startDate as string, endDate: endDate as string, asOfDate: asOfDate as string };

    const cached = await getCachedReport(tenantId, 'trial-balance', params);
    if (cached) { res.status(200).json({ success: true, data: cached }); return; }

    const report = await reportingService.getTrialBalance(
      startDate ? (startDate as string) : undefined,
      endDate ? (endDate as string) : undefined,
      asOfDate ? (asOfDate as string) : undefined
    );
    void setCachedReport(tenantId, 'trial-balance', params, report);
    res.status(200).json({ success: true, data: report });
  } catch (error: any) {
    if (error instanceof ReportingServiceError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error while generating Trial Balance report.' });
  }
});

/**
 * GET /api/v1/reports/profit-loss
 * Description: Profit & Loss Statement calculating Revenue, Expenses, and Net Profit/Loss over a date range.
 * Access: Viewer role or higher
 */
router.get('/profit-loss', requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { startDate, endDate, asOfDate, fundId } = req.query;
    const params = { startDate: startDate as string, endDate: endDate as string, asOfDate: asOfDate as string, fundId: fundId as string };

    const cached = await getCachedReport(tenantId, 'profit-loss', params);
    if (cached) { res.status(200).json({ success: true, data: cached }); return; }

    const report = await reportingService.getProfitAndLoss(
      startDate ? (startDate as string) : undefined,
      endDate ? (endDate as string) : undefined,
      asOfDate ? (asOfDate as string) : undefined,
      fundId ? (fundId as string) : undefined
    );
    void setCachedReport(tenantId, 'profit-loss', params, report);
    res.status(200).json({ success: true, data: report });
  } catch (error: any) {
    if (error instanceof ReportingServiceError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error while generating Profit & Loss report.' });
  }
});

/**
 * GET /api/v1/reports/balance-sheet
 * Description: Balance Sheet report calculating Assets, Liabilities, Equity, Retained Earnings, verifying Assets == Liabilities + Equity.
 * Access: Viewer role or higher
 */
router.get('/balance-sheet', requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { asOfDate, endDate, fundId } = req.query;
    const params = { asOfDate: asOfDate as string, endDate: endDate as string, fundId: fundId as string };

    const cached = await getCachedReport(tenantId, 'balance-sheet', params);
    if (cached) { res.status(200).json({ success: true, data: cached }); return; }

    const report = await reportingService.getBalanceSheet(
      asOfDate ? (asOfDate as string) : undefined,
      endDate ? (endDate as string) : undefined,
      fundId ? (fundId as string) : undefined
    );
    void setCachedReport(tenantId, 'balance-sheet', params, report);
    res.status(200).json({ success: true, data: report });
  } catch (error: any) {
    if (error instanceof ReportingServiceError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error while generating Balance Sheet report.' });
  }
});

/**
 * GET /api/v1/reports/balance-sheet/export?format=pdf|docx
 * Downloads the Balance Sheet as a real generated PDF or Word document.
 * Access: Viewer role or higher (matches GET /balance-sheet).
 */
router.get('/balance-sheet/export', requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const format = req.query.format as string;
    if (format !== 'pdf' && format !== 'docx') {
      res.status(400).json({ success: false, error: 'Query param "format" must be "pdf" or "docx".' });
      return;
    }

    const { asOfDate, endDate, fundId } = req.query;
    const report = await reportingService.getBalanceSheet(
      asOfDate ? (asOfDate as string) : undefined,
      endDate ? (endDate as string) : undefined,
      fundId ? (fundId as string) : undefined
    );

    const { tenantId, tenantName } = requireTenantContext();
    const { name, currency } = await resolveTenantDisplayInfo(tenantId, tenantName);
    const asOfLabel = report.asOfDate
      ? new Date(report.asOfDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const filenameBase = `Balance_Sheet_${new Date().toISOString().split('T')[0]}`;

    if (format === 'pdf') {
      const buffer = await generateBalanceSheetPdf(name, currency, asOfLabel, report);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${filenameBase}.pdf`);
      res.status(200).send(buffer);
    } else {
      const buffer = await generateBalanceSheetDocx(name, currency, asOfLabel, report);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename=${filenameBase}.docx`);
      res.status(200).send(buffer);
    }
  } catch (error: any) {
    if (error instanceof ReportingServiceError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('[Reports] Balance Sheet export error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate Balance Sheet export.' });
  }
});

/**
 * GET /api/v1/reports/profit-loss/export?format=pdf|docx
 * Downloads the Profit & Loss statement as a real generated PDF or Word document.
 * Access: Viewer role or higher (matches GET /profit-loss).
 */
router.get('/profit-loss/export', requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const format = req.query.format as string;
    if (format !== 'pdf' && format !== 'docx') {
      res.status(400).json({ success: false, error: 'Query param "format" must be "pdf" or "docx".' });
      return;
    }

    const { startDate, endDate, asOfDate, fundId } = req.query;
    const report = await reportingService.getProfitAndLoss(
      startDate ? (startDate as string) : undefined,
      endDate ? (endDate as string) : undefined,
      asOfDate ? (asOfDate as string) : undefined,
      fundId ? (fundId as string) : undefined
    );

    const { tenantId, tenantName } = requireTenantContext();
    const { name, currency } = await resolveTenantDisplayInfo(tenantId, tenantName);
    const asOfLabel = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const filenameBase = `Profit_And_Loss_${new Date().toISOString().split('T')[0]}`;
    // The PDF/DOCX generators only know Revenue/Expenses/Net Profit - fold
    // Cost of Sales into the expenses list for export so Total Revenue -
    // Total Expenses still reconciles to Net Profit on the exported
    // document, same as it does everywhere else this report is read.
    const exportData = {
      revenues: report.revenues.map(r => ({ code: r.code, name: r.name, balance: r.amount })),
      totalRevenue: report.totalRevenue,
      expenses: [...report.costOfSales, ...report.expenses].map(e => ({ code: e.code, name: e.name, balance: e.amount })),
      totalExpenses: report.totalCostOfSales + report.totalExpenses,
      netProfit: report.netProfit,
      isProfit: report.isProfit,
    };

    if (format === 'pdf') {
      const buffer = await generateProfitAndLossPdf(name, currency, asOfLabel, exportData);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${filenameBase}.pdf`);
      res.status(200).send(buffer);
    } else {
      const buffer = await generateProfitAndLossDocx(name, currency, asOfLabel, exportData);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename=${filenameBase}.docx`);
      res.status(200).send(buffer);
    }
  } catch (error: any) {
    if (error instanceof ReportingServiceError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('[Reports] Profit & Loss export error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate Profit & Loss export.' });
  }
});

/**
 * GET /api/v1/reports/cash-flow
 * Description: Indirect-method Cash Flow Statement (Operating/Investing/Financing
 * activities, Net Change in Cash) over a date range. Omit startDate/endDate for since-inception.
 * Access: Viewer role or higher
 */
router.get('/cash-flow', requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { startDate, endDate } = req.query;
    const params = { startDate: startDate as string, endDate: endDate as string };

    const cached = await getCachedReport(tenantId, 'cash-flow', params);
    if (cached) { res.status(200).json({ success: true, data: cached }); return; }

    const report = await reportingService.getCashFlowStatement(
      startDate ? (startDate as string) : undefined,
      endDate ? (endDate as string) : undefined
    );
    void setCachedReport(tenantId, 'cash-flow', params, report);
    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    if (error instanceof ReportingServiceError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Internal Server Error while generating Cash Flow Statement.',
    });
  }
});

/**
 * GET /api/v1/reports/cash-flow/export?format=pdf|docx
 * Downloads the Cash Flow Statement as a real generated PDF or Word document.
 * Access: Viewer role or higher (matches GET /cash-flow).
 */
router.get('/cash-flow/export', requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const format = req.query.format as string;
    if (format !== 'pdf' && format !== 'docx') {
      res.status(400).json({ success: false, error: 'Query param "format" must be "pdf" or "docx".' });
      return;
    }

    const { startDate, endDate } = req.query;
    const report = await reportingService.getCashFlowStatement(
      startDate ? (startDate as string) : undefined,
      endDate ? (endDate as string) : undefined
    );

    const { tenantId, tenantName } = requireTenantContext();
    const { name, currency } = await resolveTenantDisplayInfo(tenantId, tenantName);
    const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const periodLabel = report.startDate
      ? `${fmtDate(report.startDate)} to ${report.endDate ? fmtDate(report.endDate) : 'present'}`
      : `Since inception to ${report.endDate ? fmtDate(report.endDate) : 'present'}`;

    const filenameBase = `Cash_Flow_Statement_${new Date().toISOString().split('T')[0]}`;

    if (format === 'pdf') {
      const buffer = await generateCashFlowPdf(name, currency, periodLabel, report);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${filenameBase}.pdf`);
      res.status(200).send(buffer);
    } else {
      const buffer = await generateCashFlowDocx(name, currency, periodLabel, report);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename=${filenameBase}.docx`);
      res.status(200).send(buffer);
    }
  } catch (error: any) {
    if (error instanceof ReportingServiceError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('[Reports] Cash Flow Statement export error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate Cash Flow Statement export.' });
  }
});

/**
 * GET /api/v1/reports/kpis
 * Description: A lightweight financial ratio dashboard (Net Profit Margin, Return on
 * Assets, Debt-to-Equity, Cash Ratio, Equity Ratio) computed from Balance Sheet + P&L
 * totals. Omit startDate/endDate for since-inception. No Gross Margin/Current Ratio -
 * this schema has no COGS or current-vs-non-current classification to compute those honestly.
 * Access: Viewer role or higher
 */
router.get('/kpis', requireTier(2, 'KPI Dashboard'), requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { startDate, endDate } = req.query;
    const params = { startDate: startDate as string, endDate: endDate as string };

    const cached = await getCachedReport(tenantId, 'kpis', params);
    if (cached) { res.status(200).json({ success: true, data: cached }); return; }

    const report = await reportingService.getKpiDashboard(
      startDate ? (startDate as string) : undefined,
      endDate ? (endDate as string) : undefined
    );
    void setCachedReport(tenantId, 'kpis', params, report);
    res.status(200).json({ success: true, data: report });
  } catch (error: any) {
    if (error instanceof ReportingServiceError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error while generating KPI dashboard.' });
  }
});

/**
 * GET /api/v1/reports/aging/ar
 * Accounts Receivable aging - every invoice with a real outstanding balance,
 * bucketed by days past its dueDate (Current / 1-30 / 31-60 / 61-90 / 90+).
 * Access: Viewer role or higher.
 */
router.get('/aging/ar', requireTier(2, 'AP/AR Aging Analysis'), requireRole('Viewer'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();

    const cached = await getCachedReport(tenantId, 'aging-ar', {});
    if (cached) { res.status(200).json({ success: true, data: cached }); return; }

    const result = await withCurrentTenantDb(prisma, (client) => agingReportService.getArAging(client as any, tenantId));
    void setCachedReport(tenantId, 'aging-ar', {}, result);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Reports] Error generating AR aging:', error);
    res.status(500).json({ success: false, error: 'Failed to generate AR aging report.' });
  }
});

/**
 * GET /api/v1/reports/aging/ap
 * Accounts Payable aging - every UNPAID vendor bill, bucketed the same way
 * as AR (this schema has no partial-payment support for bills, so a bill's
 * balance due is always its full amount).
 * Access: Viewer role or higher.
 */
router.get('/aging/ap', requireTier(2, 'AP/AR Aging Analysis'), requireRole('Viewer'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();

    const cached = await getCachedReport(tenantId, 'aging-ap', {});
    if (cached) { res.status(200).json({ success: true, data: cached }); return; }

    const result = await withCurrentTenantDb(prisma, (client) => agingReportService.getApAging(client as any, tenantId));
    void setCachedReport(tenantId, 'aging-ap', {}, result);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Reports] Error generating AP aging:', error);
    res.status(500).json({ success: false, error: 'Failed to generate AP aging report.' });
  }
});

/**
 * GET /api/v1/reports/cash-flow-forecast?days=180
 * A recurring-transaction-aware, event-grounded forward cash projection -
 * NOT a trend-based extrapolation. Every dollar traces back to a real
 * scheduled RecurringTransaction occurrence or a real outstanding
 * Invoice/VendorBill due date, weekly-bucketed. No PDF/Word export (same
 * scope call as /kpis - a forward projection is read in-app, not typically
 * submitted as a formal document).
 * Access: Viewer role or higher.
 */
router.get('/cash-flow-forecast', requireTier(2, 'Cash Flow Forecast'), requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const days = req.query.days ? Number(req.query.days) : 180;
    const params = { days: String(days) };

    const cached = await getCachedReport(tenantId, 'cash-flow-forecast', params);
    if (cached) { res.status(200).json({ success: true, data: cached }); return; }

    const forecast = await cashFlowForecastService.getCashFlowForecast(days);
    void setCachedReport(tenantId, 'cash-flow-forecast', params, forecast);
    res.status(200).json({
      success: true,
      data: forecast,
    });
  } catch (error: any) {
    if (error instanceof CashFlowForecastServiceError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('[Reports] Cash Flow Forecast error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal Server Error while generating Cash Flow Forecast.',
    });
  }
});

/**
 * GET /api/v1/reports/sales-channel
 * Revenue breakdown by sales channel (RETAIL vs WHOLESALE) for a date range,
 * based on POS cash sales. Includes per-channel totals and item-level detail.
 * Access: Viewer role or higher.
 */
router.get('/sales-channel', requireTier(2, 'Sales Channel Report'), requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { startDate, endDate } = req.query;
    const cacheParams = { startDate: startDate as string, endDate: endDate as string };

    const cached = await getCachedReport(tenantId, 'sales-channel', cacheParams);
    if (cached) { res.status(200).json({ success: true, data: cached }); return; }

    const where: any = { tenantId, status: 'COMPLETED' };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const sales = (await withCurrentTenantDb(prisma, (client) =>
      (client as any).cashSale.findMany({
        where,
        select: {
          id: true,
          receiptNo: true,
          saleType: true,
          amount: true,
          createdAt: true,
          lines: {
            select: {
              itemName: true,
              itemSku: true,
              quantity: true,
              unitPrice: true,
              lineTotal: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    )) as any[];

    const summary = {
      RETAIL: { totalAmount: 0, count: 0 },
      WHOLESALE: { totalAmount: 0, count: 0 },
      TOTAL: { totalAmount: 0, count: 0 },
    };
    for (const sale of sales) {
      const type = sale.saleType === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
      summary[type].totalAmount += Number(sale.amount);
      summary[type].count += 1;
      summary.TOTAL.totalAmount += Number(sale.amount);
      summary.TOTAL.count += 1;
    }

    const responseData = {
      summary,
      sales: sales.map((s: any) => ({
        id: s.id,
        receiptNo: s.receiptNo,
        saleType: s.saleType,
        amount: Number(s.amount),
        createdAt: s.createdAt,
        lines: s.lines.map((l: any) => ({
          itemName: l.itemName,
          itemSku: l.itemSku,
          quantity: l.quantity,
          unitPrice: Number(l.unitPrice),
          lineTotal: Number(l.lineTotal),
        })),
      })),
    };
    void setCachedReport(tenantId, 'sales-channel', cacheParams, responseData);
    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error: any) {
    console.error('[Reports] Sales Channel error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate sales channel report.' });
  }
});

/**
 * GET /api/v1/reports/branch-comparison
 * Per-warehouse summary: cash revenue, stock value, transfers in/out.
 * Gated at Business tier (tier 2). Access: Viewer role or higher.
 */
router.get(
  '/branch-comparison',
  requireRole('Viewer'),
  requireTier(2, 'Branch Comparison Report'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = requireTenantContext();
      const { startDate, endDate } = req.query;
      const cacheParams = { startDate: startDate as string, endDate: endDate as string };

      const cached = await getCachedReport(tenantId, 'branch-comparison', cacheParams);
      if (cached) { res.status(200).json({ success: true, data: cached }); return; }

      const dateFilter: any = {};
      if (startDate) dateFilter.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }

      // All four models are public-schema Prisma models with tenantId; use prisma directly
      // (no withCurrentTenantDb needed — tenantId filter provides isolation).
      const [warehouses, sales, transfersRaw, stocksRaw] = await Promise.all([
        (prisma as any).warehouse.findMany({
          where: { tenantId },
          select: { id: true, name: true, location: true },
          orderBy: { name: 'asc' },
        }),
        (prisma as any).cashSale.groupBy({
          by: ['warehouseId'],
          where: {
            tenantId,
            status: 'COMPLETED',
            ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
          },
          _sum: { amount: true },
          _count: { id: true },
        }),
        (prisma as any).stockTransfer.findMany({
          where: {
            tenantId,
            ...(Object.keys(dateFilter).length ? { transferDate: dateFilter } : {}),
          },
          select: { fromWarehouseId: true, toWarehouseId: true },
        }),
        (prisma as any).warehouseStock.findMany({
          where: { tenantId },
          select: {
            warehouseId: true,
            quantityOnHand: true,
            item: { select: { costPrice: true } },
          },
        }),
      ]);

      // Index sales by warehouseId
      const salesByWarehouse: Record<string, { revenue: number; saleCount: number }> = {};
      for (const row of sales) {
        salesByWarehouse[row.warehouseId ?? ''] = {
          revenue: Number(row._sum.amount ?? 0),
          saleCount: row._count.id,
        };
      }

      // Count transfers in/out per warehouse
      const transfersIn: Record<string, number> = {};
      const transfersOut: Record<string, number> = {};
      for (const t of transfersRaw) {
        transfersIn[t.toWarehouseId] = (transfersIn[t.toWarehouseId] ?? 0) + 1;
        transfersOut[t.fromWarehouseId] = (transfersOut[t.fromWarehouseId] ?? 0) + 1;
      }

      // Sum stock value per warehouse
      const stockValue: Record<string, number> = {};
      for (const s of stocksRaw) {
        stockValue[s.warehouseId] = (stockValue[s.warehouseId] ?? 0) + s.quantityOnHand * Number(s.item.costPrice ?? 0);
      }

      const branches = warehouses.map((w: any) => ({
        id: w.id,
        name: w.name,
        location: w.location ?? null,
        revenue: salesByWarehouse[w.id]?.revenue ?? 0,
        saleCount: salesByWarehouse[w.id]?.saleCount ?? 0,
        stockValue: stockValue[w.id] ?? 0,
        transfersIn: transfersIn[w.id] ?? 0,
        transfersOut: transfersOut[w.id] ?? 0,
      }));

      void setCachedReport(tenantId, 'branch-comparison', cacheParams, { branches });
      res.status(200).json({ success: true, data: { branches } });
    } catch (error: any) {
      console.error('[Reports] Branch Comparison error:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to generate branch comparison report.' });
    }
  }
);

/**
 * GET /reports/landed-costs
 * Per-shipment landed cost summary: primary purchase bills with all linked
 * freight/customs/duty bills and their per-item allocation.
 * Gated at Business tier - importers/distributors feature.
 */
router.get(
  '/landed-costs',
  requireTier(2, 'Landed Cost Report'),
  requireRole('Viewer'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = requireTenantContext();
      const { from, to } = req.query as { from?: string; to?: string };
      const cacheParams = { from: from ?? '', to: to ?? '' };

      const cached = await getCachedReport(tenantId, 'landed-costs', cacheParams);
      if (cached) { res.status(200).json({ success: true, data: cached }); return; }

      const dateFilter: any = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.lte = toDate;
      }

      // Primary bills that have at least one landed cost bill linked to them
      const primaryBills = await withCurrentTenantDb(prisma, async (client) => {
        return (client as any).vendorBill.findMany({
          where: {
            tenantId,
            billType: 'STANDARD',
            landedCostBills: { some: {} },
            ...(Object.keys(dateFilter).length ? { billDate: dateFilter } : {}),
          },
          include: {
            vendor: true,
            lines: { include: { item: true } },
            landedCostBills: {
              include: { vendor: true },
            },
          },
          orderBy: { billDate: 'desc' },
        });
      }) as any[];

      const result = primaryBills.map((bill: any) => {
        const totalGoodsCost = Number(bill.baseCurrencyAmount ?? bill.amount);
        const totalLandedCost = bill.landedCostBills.reduce(
          (sum: number, lc: any) => sum + Number(lc.baseCurrencyAmount ?? lc.amount),
          0
        );
        const grandTotal = Math.round((totalGoodsCost + totalLandedCost) * 100) / 100;

        // Allocate landed cost proportionally across line items by line total
        const linesTotal = bill.lines.reduce((s: number, l: any) => s + Number(l.lineTotal), 0);
        const itemBreakdown = bill.lines.map((line: any) => {
          const lineShare = linesTotal > 0 ? Number(line.lineTotal) / linesTotal : 0;
          const allocatedLanded = Math.round(totalLandedCost * lineShare * 100) / 100;
          const totalLineCost = Math.round((Number(line.lineTotal) + allocatedLanded) * 100) / 100;
          const effectiveUnitCost = line.quantity > 0
            ? Math.round((totalLineCost / line.quantity) * 100) / 100
            : 0;
          return {
            itemId: line.itemId,
            itemName: line.item?.name ?? 'Unknown',
            itemSku: line.item?.sku ?? '',
            quantity: line.quantity,
            originalUnitCost: Number(line.unitCost),
            landedCostAllocation: allocatedLanded,
            totalLineCost,
            effectiveUnitCost,
          };
        });

        return {
          billId: bill.id,
          billNumber: bill.billNumber,
          billDate: bill.billDate,
          vendorName: bill.vendor.name,
          currency: bill.currency,
          goodsCost: totalGoodsCost,
          landedCosts: bill.landedCostBills.map((lc: any) => ({
            billId: lc.id,
            billNumber: lc.billNumber,
            vendorName: lc.vendor.name,
            description: lc.billNumber,
            amount: Number(lc.baseCurrencyAmount ?? lc.amount),
            currency: lc.currency,
          })),
          totalLandedCost: Math.round(totalLandedCost * 100) / 100,
          grandTotal,
          itemBreakdown,
        };
      });

      void setCachedReport(tenantId, 'landed-costs', cacheParams, result);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      console.error('[Reports] Landed Cost Report error:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to generate landed cost report.' });
    }
  }
);

/**
 * GET /reports/analytics/trends?months=12
 * Monthly revenue / expenses / net-profit trend for the last N months.
 * Reuses getProfitAndLoss per month so the numbers are identical to the P&L
 * the accountant already trusts. months: 3 | 6 | 12 (default 12, max 24).
 * Access: Viewer role or higher.
 */
router.get('/analytics/trends', requireTier(2, 'Analytics Dashboard'), requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const months = Math.min(24, Math.max(1, parseInt((req.query.months as string) || '12', 10) || 12));
    const params = { months: String(months) };

    const cached = await getCachedReport(tenantId, 'analytics-trends', params);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const now = new Date();
    const ranges = Array.from({ length: months }, (_, idx) => {
      const i = months - 1 - idx;
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const endDate = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      return { startDate, endDate, label };
    });

    // Run P&L calls in batches of 6 to avoid exhausting the connection pool on a
    // cold-cache request for a large trend window (up to 24 months = 24 parallel DB ops).
    const TREND_BATCH_SIZE = 6;
    const series: Array<{ month: string; label: string; revenue: number; cogs: number; expenses: number; netProfit: number }> = [];
    for (let i = 0; i < ranges.length; i += TREND_BATCH_SIZE) {
      const chunk = ranges.slice(i, i + TREND_BATCH_SIZE);
      const batchResults = await Promise.all(
        chunk.map(async ({ startDate, endDate, label }) => {
          const pnl = await reportingService.getProfitAndLoss(startDate, endDate, undefined, undefined);
          return {
            month: startDate.slice(0, 7),
            label,
            revenue: pnl.totalRevenue,
            cogs: pnl.totalCostOfSales,
            expenses: pnl.totalExpenses,
            netProfit: pnl.netProfit,
          };
        })
      );
      series.push(...batchResults);
    }

    void setCachedReport(tenantId, 'analytics-trends', params, { series });
    res.json({ success: true, data: { series } });
  } catch (error: any) {
    console.error('[Reports] Analytics trends error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate analytics trends.' });
  }
});

/**
 * GET /reports/analytics/top-customers?startDate=&endDate=&limit=10
 * Top customers ranked by total invoiced-and-paid revenue in the date range.
 * Access: Viewer role or higher.
 */
router.get('/analytics/top-customers', requireTier(2, 'Analytics Dashboard'), requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { startDate, endDate } = req.query;
    const limit = Math.min(25, Math.max(1, parseInt((req.query.limit as string) || '10', 10) || 10));
    const params = { startDate: startDate as string, endDate: endDate as string, limit: String(limit) };
    const cached = await getCachedReport(tenantId, 'analytics-top-customers', params);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate as string);
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    // Fetch invoice summaries and group in JS (avoids groupBy + tenant search_path issues).
    // Invoice and Customer are public-schema Prisma models with tenantId; use prisma directly.
    const invoiceRows = await (prisma as any).invoice.findMany({
      where: {
        tenantId,
        customerId: { not: null },
        amountPaid: { gt: 0 },
        ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
      },
      select: { customerId: true, amountPaid: true },
    }) as any[];

    const revenueMap: Record<string, { revenue: number; count: number }> = {};
    for (const row of invoiceRows) {
      if (!row.customerId) continue;
      if (!revenueMap[row.customerId]) revenueMap[row.customerId] = { revenue: 0, count: 0 };
      revenueMap[row.customerId].revenue += Number(row.amountPaid ?? 0);
      revenueMap[row.customerId].count += 1;
    }

    const topIds = Object.entries(revenueMap)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .slice(0, limit)
      .map(([id]) => id);

    const customerRecords = topIds.length
      ? await (prisma as any).customer.findMany({
          where: { id: { in: topIds }, tenantId },
          select: { id: true, name: true, email: true, customerType: true },
        }) as any[]
      : [];

    const customerMap = Object.fromEntries(customerRecords.map((c: any) => [c.id, c]));
    const customers = topIds
      .map((id) => {
        const c = customerMap[id];
        if (!c) return null;
        const stats = revenueMap[id];
        return {
          id: c.id,
          name: c.name,
          email: c.email ?? '',
          customerType: c.customerType ?? 'RETAIL',
          revenue: stats.revenue,
          invoiceCount: stats.count,
        };
      })
      .filter(Boolean);

    void setCachedReport(tenantId, 'analytics-top-customers', params, { customers });
    res.json({ success: true, data: { customers } });
  } catch (error: any) {
    console.error('[Reports] Top customers error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate top customers report.' });
  }
});

/**
 * GET /reports/analytics/top-items?startDate=&endDate=&limit=10
 * Top-selling items ranked by total POS line revenue in the date range.
 * Access: Viewer role or higher.
 */
router.get('/analytics/top-items', requireTier(2, 'Analytics Dashboard'), requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { startDate, endDate } = req.query;
    const limit = Math.min(25, Math.max(1, parseInt((req.query.limit as string) || '10', 10) || 10));
    const params = { startDate: startDate as string, endDate: endDate as string, limit: String(limit) };
    const cached = await getCachedReport(tenantId, 'analytics-top-items', params);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate as string);
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const lines = await withCurrentTenantDb(prisma, (client) =>
      (client as any).cashSaleLine.findMany({
        where: {
          tenantId,
          sale: {
            status: 'COMPLETED',
            ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
          },
        },
        select: { itemId: true, itemName: true, itemSku: true, quantity: true, lineTotal: true },
      })
    ) as any[];

    const byItem: Record<string, { itemId: string; itemName: string; itemSku: string; revenue: number; quantity: number; txnCount: number }> = {};
    for (const l of lines) {
      const key = l.itemId;
      if (!byItem[key]) {
        byItem[key] = { itemId: l.itemId, itemName: l.itemName, itemSku: l.itemSku, revenue: 0, quantity: 0, txnCount: 0 };
      }
      byItem[key].revenue += Number(l.lineTotal ?? 0);
      byItem[key].quantity += Number(l.quantity ?? 0);
      byItem[key].txnCount += 1;
    }

    const items = Object.values(byItem)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    void setCachedReport(tenantId, 'analytics-top-items', params, { items });
    res.json({ success: true, data: { items } });
  } catch (error: any) {
    console.error('[Reports] Top items error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate top items report.' });
  }
});

/**
 * GET /reports/stock-movement?itemId=&warehouseId=&startDate=&endDate=
 * Stock Movement Analysis: every stock-in and stock-out event for an item over a period,
 * with opening and closing balances. Sources: POS sales, invoice deductions,
 * vendor bill goods-receipts, stock adjustments, inter-warehouse transfers.
 * Access: Viewer role or higher.
 */
router.get('/stock-movement', requireTier(2, 'Stock Movement Report'), requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { itemId, warehouseId, startDate, endDate } = req.query;

    if (!itemId) {
      res.status(400).json({ success: false, error: 'itemId is required.' });
      return;
    }

    const cacheParams = {
      itemId: itemId as string,
      warehouseId: warehouseId as string ?? '',
      startDate: startDate as string ?? '',
      endDate: endDate as string ?? '',
    };
    const cached = await getCachedReport(tenantId, 'stock-movement', cacheParams);
    if (cached) { res.json({ success: true, data: cached }); return; }

    // Build the UNION query for stock movements, accepting up to 6 positional params:
    // $1 = tenantId, $2 = itemId, $3 = warehouseId or null, $4 = startDate, $5 = endDate
    // The optional filters are injected via dynamic SQL; parameterized values prevent injection.
    const whFilter = warehouseId ? `AND wh_col = $3` : '';
    const startFilter = startDate ? `AND event_date >= $4` : '';
    const endFilter = endDate ? `AND event_date <= $5` : '';

    const params: any[] = [tenantId, itemId as string];
    if (warehouseId) params.push(warehouseId as string);
    if (startDate) params.push(new Date(startDate as string));
    if (endDate) {
      const e = new Date(endDate as string);
      e.setHours(23, 59, 59, 999);
      params.push(e);
    }

    // Same UNION for opening balance (all movements BEFORE startDate)
    const openingParams: any[] = [tenantId, itemId as string];
    if (warehouseId) openingParams.push(warehouseId as string);
    let openingEndFilter = '';
    if (startDate) {
      openingEndFilter = `AND event_date < $${openingParams.length + 1}`;
      openingParams.push(new Date(startDate as string));
    }

    const buildUnion = (extraDateFilter: string) => `
      SELECT event_date, event_type, reference, qty_change, warehouse_id, warehouse_name, notes
      FROM (
        -- POS Sales (stock OUT)
        SELECT
          csl.created_at::date      AS event_date,
          'POS Sale'                AS event_type,
          cs.receipt_no             AS reference,
          (csl.quantity * -1)       AS qty_change,
          ct.warehouse_id           AS warehouse_id,
          w.name                    AS warehouse_name,
          NULL::text                AS notes
        FROM cash_sale_lines csl
        JOIN cash_sales cs ON cs.id = csl.sale_id AND cs.tenant_id = $1
        JOIN cash_tills ct ON ct.id = cs.till_id AND ct.tenant_id = $1
        JOIN warehouses w ON w.id = ct.warehouse_id AND w.tenant_id = $1
        WHERE csl.tenant_id = $1 AND csl.item_id = $2 AND cs.status = 'COMPLETED'
          ${warehouseId ? `AND ct.warehouse_id = $3` : ''}

        UNION ALL

        -- Invoice item deductions (stock OUT at invoice issue)
        SELECT
          i.issue_date::date        AS event_date,
          'Invoice'                 AS event_type,
          i.invoice_number          AS reference,
          (ii.quantity * -1)        AS qty_change,
          i.warehouse_id            AS warehouse_id,
          w.name                    AS warehouse_name,
          NULL::text                AS notes
        FROM invoice_items ii
        JOIN invoices i ON i.id = ii.invoice_id AND i.tenant_id = $1
        JOIN warehouses w ON w.id = i.warehouse_id AND w.tenant_id = $1
        WHERE ii.tenant_id = $1 AND ii.inventory_item_id = $2 AND i.warehouse_id IS NOT NULL
          ${warehouseId ? `AND i.warehouse_id = $3` : ''}

        UNION ALL

        -- Vendor bill goods-receipts (stock IN)
        SELECT
          vb.bill_date::date        AS event_date,
          'Purchase Receipt'        AS event_type,
          vb.bill_number            AS reference,
          vbl.quantity              AS qty_change,
          vb.warehouse_id           AS warehouse_id,
          w.name                    AS warehouse_name,
          NULL::text                AS notes
        FROM vendor_bill_lines vbl
        JOIN vendor_bills vb ON vb.id = vbl.bill_id AND vb.tenant_id = $1
        JOIN warehouses w ON w.id = vb.warehouse_id AND w.tenant_id = $1
        WHERE vbl.tenant_id = $1 AND vbl.item_id = $2
          AND vb.warehouse_id IS NOT NULL AND vb.bill_type = 'STANDARD'
          ${warehouseId ? `AND vb.warehouse_id = $3` : ''}

        UNION ALL

        -- Stock Adjustments (positive or negative delta)
        SELECT
          sa.created_at::date       AS event_date,
          'Adjustment'              AS event_type,
          sa.mode                   AS reference,
          sa.delta                  AS qty_change,
          sa.warehouse_id           AS warehouse_id,
          w.name                    AS warehouse_name,
          sa.reason                 AS notes
        FROM stock_adjustments sa
        JOIN warehouses w ON w.id = sa.warehouse_id AND w.tenant_id = $1
        WHERE sa.tenant_id = $1 AND sa.item_id = $2
          ${warehouseId ? `AND sa.warehouse_id = $3` : ''}

        UNION ALL

        -- Transfer OUT
        SELECT
          st.transfer_date::date    AS event_date,
          'Transfer Out'            AS event_type,
          st.transfer_number        AS reference,
          (sti.quantity * -1)       AS qty_change,
          st.from_warehouse_id      AS warehouse_id,
          w.name                    AS warehouse_name,
          st.notes                  AS notes
        FROM stock_transfer_items sti
        JOIN stock_transfers st ON st.id = sti.transfer_id AND st.tenant_id = $1
        JOIN warehouses w ON w.id = st.from_warehouse_id AND w.tenant_id = $1
        WHERE sti.tenant_id = $1 AND sti.item_id = $2
          ${warehouseId ? `AND st.from_warehouse_id = $3` : ''}

        UNION ALL

        -- Transfer IN
        SELECT
          st.transfer_date::date    AS event_date,
          'Transfer In'             AS event_type,
          st.transfer_number        AS reference,
          sti.quantity              AS qty_change,
          st.to_warehouse_id        AS warehouse_id,
          w.name                    AS warehouse_name,
          st.notes                  AS notes
        FROM stock_transfer_items sti
        JOIN stock_transfers st ON st.id = sti.transfer_id AND st.tenant_id = $1
        JOIN warehouses w ON w.id = st.to_warehouse_id AND w.tenant_id = $1
        WHERE sti.tenant_id = $1 AND sti.item_id = $2
          ${warehouseId ? `AND st.to_warehouse_id = $3` : ''}
      ) t
      WHERE TRUE ${extraDateFilter}
      ORDER BY event_date ASC, event_type ASC
    `;

    // Opening balance (all movements before startDate)
    let openingBalance = 0;
    if (startDate) {
      const openingRows = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
        `SELECT COALESCE(SUM(qty_change), 0) AS total FROM (${buildUnion(openingEndFilter)}) ob`,
        ...openingParams
      );
      openingBalance = Number(openingRows[0]?.total ?? 0);
    }

    // Period movements
    const periodFilter = [
      startDate ? `AND event_date >= $${warehouseId ? 4 : 3}` : '',
      endDate ? `AND event_date <= $${warehouseId ? (startDate ? 5 : 4) : (startDate ? 4 : 3)}` : '',
    ].join(' ');

    const movements = await prisma.$queryRawUnsafe<Array<{
      event_date: Date;
      event_type: string;
      reference: string;
      qty_change: bigint;
      warehouse_id: string;
      warehouse_name: string;
      notes: string | null;
    }>>(buildUnion(periodFilter), ...params);

    // Compute running balance
    let runningBalance = openingBalance;
    const rows = movements.map((m) => {
      const delta = Number(m.qty_change);
      runningBalance += delta;
      return {
        date: m.event_date,
        type: m.event_type,
        reference: m.reference,
        qtyChange: delta,
        runningBalance,
        warehouseId: m.warehouse_id,
        warehouseName: m.warehouse_name,
        notes: m.notes,
      };
    });

    // Item name lookup
    const item = await withCurrentTenantDb(prisma, (client) =>
      (client as any).inventoryItem.findFirst({
        where: { id: itemId as string, tenantId },
        select: { name: true, sku: true },
      })
    );

    const stockMovementData = {
      item: item ? { id: itemId, name: (item as any).name, sku: (item as any).sku } : { id: itemId },
      openingBalance,
      closingBalance: runningBalance,
      movements: rows,
    };
    void setCachedReport(tenantId, 'stock-movement', cacheParams, stockMovementData);
    res.json({
      success: true,
      data: stockMovementData,
    });
  } catch (error: any) {
    console.error('[Reports] Stock movement error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate stock movement report.' });
  }
});

/**
 * GET /reports/sales-register?startDate=&endDate=&page=1&pageSize=100
 * Sales Register: one row per invoice in date order for a period.
 * Returns: invoice number, date, customer, subtotal, tax, total, currency, payment status.
 * Standard statutory report used by VAT filers to reconcile output tax.
 * Access: Viewer role or higher.
 */
router.get('/sales-register', requireTier(2, 'Sales & Purchase Registers'), requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { startDate, endDate } = req.query;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10) || 1);
    const pageSize = Math.min(500, Math.max(1, parseInt((req.query.pageSize as string) || '100', 10) || 100));
    const cacheParams = { startDate: startDate as string, endDate: endDate as string, page: String(page), pageSize: String(pageSize) };

    const cached = await getCachedReport(tenantId, 'sales-register', cacheParams);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) dateFilter.gte = new Date(startDate as string);
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const where = {
      tenantId,
      ...(Object.keys(dateFilter).length ? { issueDate: dateFilter } : {}),
    };

    const [total, invoices] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        include: { customer: { select: { id: true, name: true } } },
        orderBy: { issueDate: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const rows = invoices.map((inv) => ({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      date: inv.issueDate,
      dueDate: inv.dueDate,
      customerName: (inv as any).customer?.name ?? 'Unknown',
      currency: inv.currency,
      subtotal: Number(inv.subtotal),
      tax: Number(inv.tax),
      total: Number(inv.total),
      status: inv.status,
    }));

    const totals = {
      subtotal: Math.round(rows.reduce((s, r) => s + r.subtotal, 0) * 100) / 100,
      tax: Math.round(rows.reduce((s, r) => s + r.tax, 0) * 100) / 100,
      total: Math.round(rows.reduce((s, r) => s + r.total, 0) * 100) / 100,
    };

    const salesRegisterData = {
      rows,
      totals,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
    void setCachedReport(tenantId, 'sales-register', cacheParams, salesRegisterData);
    res.json({
      success: true,
      data: salesRegisterData,
    });
  } catch (error: any) {
    console.error('[Reports] Sales register error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate sales register.' });
  }
});

/**
 * GET /reports/purchase-register?startDate=&endDate=&page=1&pageSize=100
 * Purchase Register: one row per vendor bill in date order for a period.
 * Returns: bill number, date, vendor name, amount, currency, payment status.
 * Standard statutory report used by VAT filers to reconcile input tax.
 * Access: Viewer role or higher.
 */
router.get('/purchase-register', requireTier(2, 'Sales & Purchase Registers'), requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { startDate, endDate } = req.query;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10) || 1);
    const pageSize = Math.min(500, Math.max(1, parseInt((req.query.pageSize as string) || '100', 10) || 100));
    const cacheParams = { startDate: startDate as string, endDate: endDate as string, page: String(page), pageSize: String(pageSize) };

    const cached = await getCachedReport(tenantId, 'purchase-register', cacheParams);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) dateFilter.gte = new Date(startDate as string);
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const where = {
      tenantId,
      billType: 'STANDARD',
      ...(Object.keys(dateFilter).length ? { billDate: dateFilter } : {}),
    };

    const [total, bills] = await Promise.all([
      prisma.vendorBill.count({ where }),
      prisma.vendorBill.findMany({
        where,
        include: { vendor: { select: { id: true, name: true } } },
        orderBy: { billDate: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const rows = bills.map((bill) => ({
      billId: bill.id,
      billNumber: bill.billNumber,
      date: bill.billDate,
      dueDate: bill.dueDate,
      vendorName: (bill as any).vendor?.name ?? 'Unknown',
      currency: bill.currency,
      amount: Number(bill.amount),
      status: bill.status,
    }));

    const totals = {
      amount: Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100,
    };

    const purchaseRegisterData = {
      rows,
      totals,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
    void setCachedReport(tenantId, 'purchase-register', cacheParams, purchaseRegisterData);
    res.json({
      success: true,
      data: purchaseRegisterData,
    });
  } catch (error: any) {
    console.error('[Reports] Purchase register error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate purchase register.' });
  }
});

/**
 * GET /reports/daybook?startDate=&endDate=&page=1&pageSize=50
 * Daybook: every posted journal voucher in date order with all debit/credit lines.
 * This is the TallyPrime "Daybook" equivalent — the chronological ledger of all
 * financial events for a date range, showing the full double-entry breakdown per voucher.
 * Access: Viewer role or higher.
 */
router.get('/daybook', requireTier(2, 'Daybook'), requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { startDate, endDate } = req.query;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt((req.query.pageSize as string) || '50', 10) || 50));
    const cacheParams = { startDate: startDate as string, endDate: endDate as string, page: String(page), pageSize: String(pageSize) };

    const cached = await getCachedReport(tenantId, 'daybook', cacheParams);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const dateFilter: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (startDate) {
      dateFilter.push(`je.entry_date >= $${paramIdx++}`);
      values.push(new Date(startDate as string));
    }
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      dateFilter.push(`je.entry_date <= $${paramIdx++}`);
      values.push(end);
    }

    const whereClause = dateFilter.length
      ? `WHERE je.status = 'POSTED' AND ${dateFilter.join(' AND ')}`
      : `WHERE je.status = 'POSTED'`;

    // Count total vouchers for pagination
    const countResult = await withCurrentTenantDb(prisma, (client) =>
      (client as any).$queryRawUnsafe(
        `SELECT COUNT(DISTINCT je.id)::int AS total
         FROM journal_entries je
         ${whereClause}`,
        ...values
      )
    ) as any[];
    const total: number = countResult[0]?.total ?? 0;

    // Fetch paged vouchers with all lines and account names
    const offset = (page - 1) * pageSize;
    const rows = await withCurrentTenantDb(prisma, (client) =>
      (client as any).$queryRawUnsafe(
        `SELECT
           je.id            AS "entryId",
           je.entry_number  AS "entryNumber",
           je.entry_date    AS "entryDate",
           je.description   AS "description",
           jel.id           AS "lineId",
           jel.debit        AS "debit",
           jel.credit       AS "credit",
           jel.description  AS "lineDescription",
           a.name           AS "accountName",
           a.code           AS "accountCode"
         FROM journal_entries je
         JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
         JOIN accounts a ON a.id = jel.account_id
         ${whereClause}
         ORDER BY je.entry_date ASC, je.entry_number ASC, jel.id ASC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        ...values, pageSize, offset
      )
    ) as any[];

    // Group flat rows back into vouchers with lines[]
    const voucherMap = new Map<string, any>();
    for (const row of rows) {
      if (!voucherMap.has(row.entryId)) {
        voucherMap.set(row.entryId, {
          entryId: row.entryId,
          entryNumber: row.entryNumber,
          entryDate: row.entryDate,
          description: row.description,
          lines: [],
        });
      }
      voucherMap.get(row.entryId).lines.push({
        lineId: row.lineId,
        accountName: row.accountName,
        accountCode: row.accountCode,
        debit: Number(row.debit ?? 0),
        credit: Number(row.credit ?? 0),
        description: row.lineDescription,
      });
    }

    const vouchers = Array.from(voucherMap.values());

    const daybookData = {
      vouchers,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
    void setCachedReport(tenantId, 'daybook', cacheParams, daybookData);
    res.json({
      success: true,
      data: daybookData,
    });
  } catch (error: any) {
    console.error('[Reports] Daybook error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate daybook report.' });
  }
});

/**
 * GET /api/v1/reports/cost-centre-pnl?costCentreId=&startDate=&endDate=
 * Cost-centre filtered P&L: filters ledger rows tagged to the given cost_centre_id.
 * Access: Viewer role or higher.
 */
router.get('/cost-centre-pnl', requireTier(2, 'Cost Centre P&L'), requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { costCentreId, startDate, endDate } = req.query;

    if (!costCentreId) {
      res.status(400).json({ success: false, error: 'costCentreId is required.' });
      return;
    }

    const cacheParams = { costCentreId: costCentreId as string, startDate: startDate as string, endDate: endDate as string };
    const cached = await getCachedReport(tenantId, 'cost-centre-pnl', cacheParams);
    if (cached) { res.json({ success: true, data: cached }); return; }

    // Validate cost centre belongs to this tenant
    const cc = await (prisma as any).costCentre.findFirst({
      where: { id: costCentreId as string, tenantId },
    });
    if (!cc) {
      res.status(404).json({ success: false, error: 'Cost centre not found.' });
      return;
    }

    const report = await withCurrentTenantDb(prisma, async (client) => {
      const conditions: string[] = [`a.type IN ('REVENUE', 'EXPENSE', 'COST_OF_SALES')`];
      const params: any[] = [costCentreId as string];
      let paramIdx = 2;

      const ledgerConditions: string[] = [`l.cost_centre_id = $1::uuid`];

      if (startDate) {
        ledgerConditions.push(`l.transaction_date >= $${paramIdx++}::date`);
        params.push(startDate as string);
      }
      if (endDate) {
        ledgerConditions.push(`l.transaction_date <= $${paramIdx++}::date`);
        params.push(endDate as string);
      }

      const joinWhere = `AND ${ledgerConditions.join(' AND ')}`;

      const sql = `
        SELECT
          a.id,
          a.code,
          a.name,
          a.type,
          COALESCE(SUM(l.debit), 0)  AS total_debit,
          COALESCE(SUM(l.credit), 0) AS total_credit
        FROM accounts a
        LEFT JOIN ledgers l ON a.id = l.account_id ${joinWhere}
        WHERE ${conditions.join(' AND ')}
        GROUP BY a.id, a.code, a.name, a.type
        ORDER BY a.code ASC
      `;

      const rows: any[] = await (client as any).$queryRawUnsafe(sql, ...params);

      const revenues: any[] = [];
      const costOfSales: any[] = [];
      const expenses: any[] = [];
      let totalRevenue = 0;
      let totalCostOfSales = 0;
      let totalExpenses = 0;

      for (const r of rows) {
        const debit = parseFloat(r.total_debit);
        const credit = parseFloat(r.total_credit);
        if (r.type === 'REVENUE') {
          const amount = Math.round((credit - debit) * 100) / 100;
          totalRevenue += amount;
          revenues.push({ id: r.id, code: r.code, name: r.name, type: r.type, amount });
        } else if (r.type === 'COST_OF_SALES') {
          const amount = Math.round((debit - credit) * 100) / 100;
          totalCostOfSales += amount;
          costOfSales.push({ id: r.id, code: r.code, name: r.name, type: r.type, amount });
        } else if (r.type === 'EXPENSE') {
          const amount = Math.round((debit - credit) * 100) / 100;
          totalExpenses += amount;
          expenses.push({ id: r.id, code: r.code, name: r.name, type: r.type, amount });
        }
      }

      const grossProfit = Math.round((totalRevenue - totalCostOfSales) * 100) / 100;
      const netProfit = Math.round((grossProfit - totalExpenses) * 100) / 100;

      return {
        costCentre: { id: cc.id, code: cc.code, name: cc.name },
        startDate: startDate || null,
        endDate: endDate || null,
        revenues,
        costOfSales,
        expenses,
        totalRevenue,
        totalCostOfSales,
        grossProfit,
        totalExpenses,
        netProfit,
      };
    });

    void setCachedReport(tenantId, 'cost-centre-pnl', cacheParams, report);
    res.json({ success: true, data: report });
  } catch (err: any) {
    console.error('[Reports] cost-centre-pnl error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate cost centre P&L report.' });
  }
});

/**
 * GET /api/v1/reports/vat-return?startDate=&endDate=
 * VAT Return: output VAT collected on invoices (via invoice payments) for a period,
 * grouped by tax rate. Input VAT from bills is not separately tracked — note is returned.
 * Access: Viewer role or higher.
 */
router.get('/vat-return', requireTier(2, 'VAT Return Report'), requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { startDate, endDate } = req.query;
    const params = { startDate: startDate as string, endDate: endDate as string };

    const cached = await getCachedReport(tenantId, 'vat-return', params);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const report = await reportingService.getVatReturn(
      startDate ? (startDate as string) : undefined,
      endDate ? (endDate as string) : undefined
    );
    void setCachedReport(tenantId, 'vat-return', params, report);
    res.json({ success: true, data: report });
  } catch (error: any) {
    if (error instanceof ReportingServiceError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('[Reports] VAT Return error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate VAT Return.' });
  }
});

/**
 * GET /api/v1/reports/stock-aging?asOfDate=
 * Stock Aging: inventory bucketed by days on hand (0-30, 31-60, 61-90, 90+).
 * FIFO tenants use actual stock lots; Average-cost tenants use warehouse stock + oldest adjustment date.
 * Access: Viewer role or higher.
 */
router.get('/stock-aging', requireTier(2, 'Stock Aging Report'), requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { asOfDate } = req.query;
    const params = { asOfDate: asOfDate as string };

    const cached = await getCachedReport(tenantId, 'stock-aging', params);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const report = await reportingService.getStockAging(asOfDate ? (asOfDate as string) : undefined);
    void setCachedReport(tenantId, 'stock-aging', params, report);
    res.json({ success: true, data: report });
  } catch (error: any) {
    if (error instanceof ReportingServiceError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('[Reports] Stock Aging error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate Stock Aging report.' });
  }
});

/**
 * GET /api/v1/reports/financial-ratios?startDate=&endDate=&asOfDate=
 * Financial Ratio Analysis: solvency, profitability, and efficiency ratios
 * derived from Balance Sheet + P&L totals. Current/quick ratios are omitted
 * because current vs non-current classification is not tracked in the schema.
 * Access: Viewer role or higher.
 */
router.get('/financial-ratios', requireTier(2, 'Financial Ratios'), requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { startDate, endDate, asOfDate } = req.query;
    const params = { startDate: startDate as string, endDate: endDate as string, asOfDate: asOfDate as string };

    const cached = await getCachedReport(tenantId, 'financial-ratios', params);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const report = await reportingService.getFinancialRatios(
      startDate ? (startDate as string) : undefined,
      endDate ? (endDate as string) : undefined,
      asOfDate ? (asOfDate as string) : undefined
    );
    void setCachedReport(tenantId, 'financial-ratios', params, report);
    res.json({ success: true, data: report });
  } catch (error: any) {
    if (error instanceof ReportingServiceError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('[Reports] Financial Ratios error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate Financial Ratios report.' });
  }
});

/**
 * GET /api/v1/reports/cost-category-pnl?costCategoryId=&startDate=&endDate=
 * P&L breakdown for a single cost category (journal lines tagged with the category).
 * Access: Viewer role or higher.
 */
router.get('/cost-category-pnl', requireTier(2, 'Cost Centre P&L'), requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { costCategoryId, startDate, endDate } = req.query;
    if (!costCategoryId) { res.status(400).json({ success: false, error: 'costCategoryId is required.' }); return; }
    const params = { costCategoryId: costCategoryId as string, startDate: startDate as string, endDate: endDate as string };

    const cached = await getCachedReport(tenantId, 'cost-category-pnl', params);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const report = await reportingService.getCostCategoryPnl(
      costCategoryId as string,
      startDate ? (startDate as string) : undefined,
      endDate ? (endDate as string) : undefined
    );
    void setCachedReport(tenantId, 'cost-category-pnl', params, report);
    res.json({ success: true, data: report });
  } catch (error: any) {
    if (error instanceof ReportingServiceError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('[Reports] Cost Category P&L error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate Cost Category P&L report.' });
  }
});

/**
 * GET /api/v1/reports/benford-analysis
 * Description: Benford's Law leading-digit distribution analysis on posted journal entry line amounts.
 *   Flags digits whose observed frequency deviates significantly from the logarithmic Benford curve
 *   (Z-score > 1.96) and an overall chi-square goodness-of-fit test (df=8, p<0.05 threshold = 15.507).
 *   Useful for detecting fabricated transaction amounts, salami-slicing, or internal fraud patterns.
 * Query params: startDate, endDate (YYYY-MM-DD, optional)
 * Access: Accountant role or higher
 */
router.get('/benford-analysis', requireTier(2, 'Benford Analysis'), requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { startDate, endDate } = req.query;
    const params = { startDate: startDate as string, endDate: endDate as string };

    const cached = await getCachedReport(tenantId, 'benford-analysis', params);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const report = await reportingService.getBenfordAnalysis(
      startDate ? (startDate as string) : undefined,
      endDate ? (endDate as string) : undefined
    );
    void setCachedReport(tenantId, 'benford-analysis', params, report);
    res.json({ success: true, data: report });
  } catch (error: any) {
    if (error instanceof ReportingServiceError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('[Reports] Benford analysis error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to run Benford analysis.' });
  }
});

/**
 * GET /api/v1/reports/fraud/duplicate-payments
 * Description: Lists payment groups where the same customer name, amount, and payment date
 *   appear more than once — a common indicator of accidental double-entry or intentional fraud.
 * Query params: startDate, endDate (YYYY-MM-DD, optional)
 * Access: Auditor role or higher
 */
router.get('/fraud/duplicate-payments', requireTier(2, 'Fraud Detection'), requireRole('Auditor'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { startDate, endDate } = req.query;
    const params = { startDate: startDate as string, endDate: endDate as string };

    const cached = await getCachedReport(tenantId, 'fraud-duplicate-payments', params);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const report = await reportingService.getDuplicatePayments(
      startDate ? (startDate as string) : undefined,
      endDate ? (endDate as string) : undefined
    );
    void setCachedReport(tenantId, 'fraud-duplicate-payments', params, report);
    res.json({ success: true, data: report });
  } catch (error: any) {
    if (error instanceof ReportingServiceError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('[Reports] Duplicate payments error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to run duplicate payment analysis.' });
  }
});

/**
 * GET /api/v1/reports/fraud/round-amounts
 * Description: Lists posted journal entry lines whose absolute amount is a round multiple of
 *   the specified threshold (default 100) and above a minimum (default 500). Round amounts
 *   can indicate estimates, fabrications, or expense-splitting schemes.
 * Query params: minAmount (default 500), roundingThreshold (default 100), startDate, endDate
 * Access: Auditor role or higher
 */
router.get('/fraud/round-amounts', requireTier(2, 'Fraud Detection'), requireRole('Auditor'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { minAmount, roundingThreshold, startDate, endDate } = req.query;
    const params = {
      minAmount: minAmount as string,
      roundingThreshold: roundingThreshold as string,
      startDate: startDate as string,
      endDate: endDate as string,
    };

    const cached = await getCachedReport(tenantId, 'fraud-round-amounts', params);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const report = await reportingService.getRoundAmountTransactions(
      minAmount ? Number(minAmount) : undefined,
      roundingThreshold ? Number(roundingThreshold) : undefined,
      startDate ? (startDate as string) : undefined,
      endDate ? (endDate as string) : undefined
    );
    void setCachedReport(tenantId, 'fraud-round-amounts', params, report);
    res.json({ success: true, data: report });
  } catch (error: any) {
    if (error instanceof ReportingServiceError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    console.error('[Reports] Round amounts error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to run round-amount analysis.' });
  }
});

// Monthly Sales Ledger — Tier 1+ (all plans), Viewer+
router.get('/monthly-sales-ledger', requireRole('Viewer'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
    const month = parseInt(req.query.month as string, 10) || (new Date().getMonth() + 1);
    if (month < 1 || month > 12) {
      res.status(400).json({ success: false, error: 'month must be 1-12' });
      return;
    }
    const params = { year: String(year), month: String(month) };
    const cached = await getCachedReport(tenantId, 'monthly-sales-ledger', params);
    if (cached) { res.json({ success: true, data: cached }); return; }
    const ledger = await monthlySalesLedgerService.getMonthlySalesLedger(tenantId, year, month);
    void setCachedReport(tenantId, 'monthly-sales-ledger', params, ledger);
    res.json({ success: true, data: ledger });
  } catch (error: any) {
    console.error('[Reports] Monthly sales ledger error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate monthly sales ledger.' });
  }
});

// Close a month — Accountant or Admin only
router.post('/month-close', requireRole('Accountant'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { year, month } = req.body as { year: number; month: number };
    if (!year || !month || month < 1 || month > 12) {
      res.status(400).json({ success: false, error: 'year and month (1-12) are required.' });
      return;
    }
    const userId = (req as any).user?.id ?? null;
    const userName = (req as any).user?.name || (req as any).user?.email || null;
    const record = await monthlySalesLedgerService.closeMonth(tenantId, year, month, userId, userName);
    res.json({ success: true, data: record });
  } catch (error: any) {
    console.error('[Reports] Close month error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to close month.' });
  }
});

// List all month-close records (performance history)
router.get('/month-closes', requireRole('Viewer'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const cached = await getCachedReport(tenantId, 'month-closes', {});
    if (cached) { res.json({ success: true, data: cached }); return; }
    const records = await monthlySalesLedgerService.getMonthCloses(tenantId);
    void setCachedReport(tenantId, 'month-closes', {}, records);
    res.json({ success: true, data: records });
  } catch (error: any) {
    console.error('[Reports] Month closes error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to get month close history.' });
  }
});

export default router;
