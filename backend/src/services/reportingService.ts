import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { requireTenantContext } from '../context/tenantContext';
import * as reportRepository from '../repository/reportRepository';
import {
  TrialBalanceResult,
  ProfitLossResult,
  BalanceSheetResult,
  CashFlowResult,
  KpiDashboardResult,
} from '../repository/reportRepository';

export class ReportingServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'ReportingServiceError';
    this.statusCode = statusCode;
  }
}

function validateDateFormat(dateStr: string, paramName: string) {
  if (!dateStr) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new ReportingServiceError(`Invalid ${paramName} format. Expected YYYY-MM-DD.`, 400);
  }
  // Also validate the date is semantically valid (e.g. not 2026-13-45)
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime()) || parsed.toISOString().split('T')[0] !== dateStr) {
    throw new ReportingServiceError(`Invalid ${paramName} format. Expected YYYY-MM-DD.`, 400);
  }
}

export async function getTrialBalance(
  startDate?: string,
  endDate?: string,
  asOfDate?: string
): Promise<TrialBalanceResult> {
  if (startDate) validateDateFormat(startDate, 'startDate');
  if (endDate) validateDateFormat(endDate, 'endDate');
  if (asOfDate) validateDateFormat(asOfDate, 'asOfDate');

  return withCurrentTenantDb(prisma, async (client) => {
    return reportRepository.getTrialBalance(client, startDate, endDate, asOfDate);
  });
}

export async function getProfitAndLoss(
  startDate?: string,
  endDate?: string,
  asOfDate?: string,
  fundId?: string
): Promise<ProfitLossResult> {
  if (startDate) validateDateFormat(startDate, 'startDate');
  if (endDate) validateDateFormat(endDate, 'endDate');
  if (asOfDate) validateDateFormat(asOfDate, 'asOfDate');

  return withCurrentTenantDb(prisma, async (client) => {
    return reportRepository.getProfitAndLoss(client, startDate, endDate, asOfDate, fundId);
  });
}

export async function getBalanceSheet(
  asOfDate?: string,
  endDate?: string,
  fundId?: string
): Promise<BalanceSheetResult> {
  if (asOfDate) validateDateFormat(asOfDate, 'asOfDate');
  if (endDate) validateDateFormat(endDate, 'endDate');

  return withCurrentTenantDb(prisma, async (client) => {
    return reportRepository.getBalanceSheet(client, asOfDate, endDate, fundId);
  });
}

export async function getCashFlowStatement(
  startDate?: string,
  endDate?: string
): Promise<CashFlowResult> {
  if (startDate) validateDateFormat(startDate, 'startDate');
  if (endDate) validateDateFormat(endDate, 'endDate');

  return withCurrentTenantDb(prisma, async (client) => {
    return reportRepository.getCashFlowStatement(client, startDate, endDate);
  });
}

export async function getKpiDashboard(
  startDate?: string,
  endDate?: string
): Promise<KpiDashboardResult> {
  if (startDate) validateDateFormat(startDate, 'startDate');
  if (endDate) validateDateFormat(endDate, 'endDate');

  return withCurrentTenantDb(prisma, async (client) => {
    return reportRepository.getKpiDashboard(client, startDate, endDate);
  });
}

export async function getVatReturn(startDate?: string, endDate?: string) {
  if (startDate) validateDateFormat(startDate, 'startDate');
  if (endDate) validateDateFormat(endDate, 'endDate');
  const { tenantId } = requireTenantContext();

  return withCurrentTenantDb(prisma, async (client) => {
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const payments = await (client as any).invoicePayment.findMany({
      where: {
        tenantId,
        ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
      },
      include: { invoice: { include: { taxRate: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const outputVatMap = new Map<string, { taxRateName: string; taxRate: number; taxableAmount: number; taxAmount: number }>();

    for (const payment of payments) {
      const invoice = payment.invoice;
      if (!invoice) continue;
      const invoiceTotal = Number(invoice.total);
      const invoiceTax = Number(invoice.tax ?? 0);
      if (invoiceTax <= 0 || invoiceTotal <= 0) continue;

      const paymentAmount = Number(payment.amount);
      const paymentShare = paymentAmount / invoiceTotal;
      const taxForPayment = Math.round(invoiceTax * paymentShare * 100) / 100;
      const taxableForPayment = Math.round((paymentAmount - taxForPayment) * 100) / 100;

      const taxRateName = invoice.taxRate?.name ?? 'Standard VAT';
      const taxRatePercent = invoice.taxRate?.rate != null ? Number(invoice.taxRate.rate) : 0;

      const existing = outputVatMap.get(taxRateName);
      if (existing) {
        existing.taxableAmount += taxableForPayment;
        existing.taxAmount += taxForPayment;
      } else {
        outputVatMap.set(taxRateName, { taxRateName, taxRate: taxRatePercent, taxableAmount: taxableForPayment, taxAmount: taxForPayment });
      }
    }

    const outputVatLines = Array.from(outputVatMap.values()).map((l) => ({
      ...l,
      taxableAmount: Math.round(l.taxableAmount * 100) / 100,
      taxAmount: Math.round(l.taxAmount * 100) / 100,
    }));

    const totalOutputTaxable = Math.round(outputVatLines.reduce((s, l) => s + l.taxableAmount, 0) * 100) / 100;
    const totalOutputVat = Math.round(outputVatLines.reduce((s, l) => s + l.taxAmount, 0) * 100) / 100;

    return {
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      outputVat: { lines: outputVatLines, totalTaxableAmount: totalOutputTaxable, totalTaxAmount: totalOutputVat },
      inputVatNote: 'Input VAT from vendor bills is not separately tracked. Use the Purchase Register report to reconcile input tax.',
      netVatPayable: totalOutputVat,
    };
  });
}

function _buildStockAgingResult(
  rows: { itemId: string; itemName: string; itemSku: string; warehouseId: string; warehouseName: string; qty: number; unitCost: number; purchasedAt: Date }[],
  asOf: Date
) {
  const buckets: Record<string, number> = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  const bucketValue: Record<string, number> = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  const items: any[] = [];

  for (const row of rows) {
    const daysOnHand = Math.floor((asOf.getTime() - row.purchasedAt.getTime()) / 86400000);
    const bucket = daysOnHand <= 30 ? '0-30' : daysOnHand <= 60 ? '31-60' : daysOnHand <= 90 ? '61-90' : '90+';
    const value = Math.round(row.qty * row.unitCost * 100) / 100;
    buckets[bucket] += row.qty;
    bucketValue[bucket] += value;
    items.push({ ...row, daysOnHand, bucket, value });
  }

  return {
    asOfDate: asOf.toISOString().split('T')[0],
    bucketSummary: {
      '0-30':  { qty: buckets['0-30'],  value: Math.round(bucketValue['0-30']  * 100) / 100 },
      '31-60': { qty: buckets['31-60'], value: Math.round(bucketValue['31-60'] * 100) / 100 },
      '61-90': { qty: buckets['61-90'], value: Math.round(bucketValue['61-90'] * 100) / 100 },
      '90+':   { qty: buckets['90+'],   value: Math.round(bucketValue['90+']   * 100) / 100 },
    },
    totalQty: items.reduce((s, i) => s + i.qty, 0),
    totalValue: Math.round(items.reduce((s, i) => s + i.value, 0) * 100) / 100,
    items: items.sort((a, b) => b.daysOnHand - a.daysOnHand),
  };
}

export async function getStockAging(asOfDate?: string) {
  if (asOfDate) validateDateFormat(asOfDate, 'asOfDate');
  const { tenantId } = requireTenantContext();
  const asOf = asOfDate ? new Date(asOfDate) : new Date();
  asOf.setHours(23, 59, 59, 999);

  return withCurrentTenantDb(prisma, async (client) => {
    const tenant = await (client as any).tenant.findUnique({
      where: { id: tenantId },
      select: { stockValuationMethod: true },
    });
    const isFifo = tenant?.stockValuationMethod === 'FIFO';

    if (isFifo) {
      const layers = await (client as any).stockLayer.findMany({
        where: { tenantId, remainingQty: { gt: 0 }, purchasedAt: { lte: asOf } },
        include: {
          item: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true } },
        },
        orderBy: { purchasedAt: 'asc' },
      });

      return _buildStockAgingResult(
        layers.map((l: any) => ({
          itemId: l.item?.id ?? '',
          itemName: l.item?.name ?? 'Unknown',
          itemSku: l.item?.sku ?? '',
          warehouseId: l.warehouse?.id ?? '',
          warehouseName: l.warehouse?.name ?? 'Unknown',
          qty: Number(l.remainingQty),
          unitCost: Number(l.unitCost),
          purchasedAt: l.purchasedAt,
        })),
        asOf
      );
    } else {
      const [stocks, adjustments] = await Promise.all([
        (client as any).warehouseStock.findMany({
          where: { tenantId, quantityOnHand: { gt: 0 } },
          include: {
            item: { select: { id: true, name: true, sku: true, costPrice: true } },
            warehouse: { select: { id: true, name: true } },
          },
        }),
        (client as any).stockAdjustment.findMany({
          where: { tenantId },
          select: { itemId: true, warehouseId: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

      const oldestAdjMap = new Map<string, Date>();
      for (const adj of adjustments) {
        const key = `${adj.itemId}:${adj.warehouseId}`;
        if (!oldestAdjMap.has(key)) oldestAdjMap.set(key, adj.createdAt);
      }

      return _buildStockAgingResult(
        stocks.map((s: any) => ({
          itemId: s.item?.id ?? '',
          itemName: s.item?.name ?? 'Unknown',
          itemSku: s.item?.sku ?? '',
          warehouseId: s.warehouse?.id ?? '',
          warehouseName: s.warehouse?.name ?? 'Unknown',
          qty: Number(s.quantityOnHand),
          unitCost: Number(s.item?.costPrice ?? 0),
          purchasedAt: oldestAdjMap.get(`${s.itemId}:${s.warehouseId}`) ?? asOf,
        })),
        asOf
      );
    }
  });
}

export async function getFinancialRatios(startDate?: string, endDate?: string, asOfDate?: string) {
  if (startDate) validateDateFormat(startDate, 'startDate');
  if (endDate) validateDateFormat(endDate, 'endDate');
  if (asOfDate) validateDateFormat(asOfDate, 'asOfDate');

  const [bs, pnl] = await Promise.all([
    getBalanceSheet(asOfDate, endDate),
    getProfitAndLoss(startDate, endDate, asOfDate),
  ]);

  const totalAssets = bs.totalAssets ?? 0;
  const totalLiabilities = bs.totalLiabilities ?? 0;
  const totalEquity = bs.totalEquity ?? 0;
  const revenue = pnl.totalRevenue ?? 0;
  const netProfit = pnl.netProfit ?? 0;

  const safe = (num: number, den: number): number | null =>
    den !== 0 ? Math.round((num / den) * 10000) / 10000 : null;

  return {
    asOfDate: asOfDate ?? new Date().toISOString().split('T')[0],
    startDate: startDate ?? null,
    endDate: endDate ?? null,
    balanceTotals: { totalAssets, totalLiabilities, totalEquity },
    incomeTotals: { revenue, netProfit },
    ratios: {
      solvency: {
        debtToEquity:  { value: safe(totalLiabilities, totalEquity), label: 'Debt-to-Equity', lowerIsBetter: true },
        debtToAssets:  { value: safe(totalLiabilities, totalAssets),  label: 'Debt-to-Assets',  lowerIsBetter: true },
        equityRatio:   { value: safe(totalEquity,      totalAssets),  label: 'Equity Ratio',    lowerIsBetter: false },
      },
      profitability: {
        netProfitMargin: { value: safe(netProfit, revenue),      label: 'Net Profit Margin', lowerIsBetter: false, isPercent: true },
        returnOnAssets:  { value: safe(netProfit, totalAssets),  label: 'Return on Assets',  lowerIsBetter: false, isPercent: true },
        returnOnEquity:  { value: safe(netProfit, totalEquity),  label: 'Return on Equity',  lowerIsBetter: false, isPercent: true },
      },
      efficiency: {
        assetTurnover: { value: safe(revenue, totalAssets), label: 'Asset Turnover', lowerIsBetter: false },
      },
    },
    note: 'Current vs non-current classification is not tracked — liquidity ratios (Current Ratio, Quick Ratio) require that classification and cannot be computed from available data.',
  };
}

export async function getCostCategoryPnl(costCategoryId: string, startDate?: string, endDate?: string) {
  if (startDate) validateDateFormat(startDate, 'startDate');
  if (endDate) validateDateFormat(endDate, 'endDate');
  const { tenantId } = requireTenantContext();

  return withCurrentTenantDb(prisma, async (client) => {
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const category = await (client as any).costCategory.findFirst({ where: { id: costCategoryId, tenantId } });
    if (!category) throw new Error('Cost category not found.');

    const lines = await (client as any).journalEntryLine.findMany({
      where: {
        costCategoryId,
        journalEntry: {
          status: 'POSTED',
          ...(Object.keys(dateFilter).length ? { entryDate: dateFilter } : {}),
        },
      },
      include: { account: true, journalEntry: { select: { entryDate: true, description: true, entryNumber: true } } },
      orderBy: { journalEntry: { entryDate: 'asc' } },
    });

    let totalDebit = 0;
    let totalCredit = 0;
    const rows = lines.map((l: any) => {
      const debit = Number(l.debit);
      const credit = Number(l.credit);
      totalDebit += debit;
      totalCredit += credit;
      return {
        date: l.journalEntry.entryDate,
        entryNumber: l.journalEntry.entryNumber,
        description: l.journalEntry.description ?? l.account.name,
        accountName: l.account.name,
        accountType: l.account.type,
        debit,
        credit,
      };
    });

    return { category: { id: category.id, name: category.name }, lines: rows, totalDebit, totalCredit, net: totalCredit - totalDebit };
  });
}
