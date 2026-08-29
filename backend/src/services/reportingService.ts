import { Decimal } from '@prisma/client/runtime/library';
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

    const outputVatMap = new Map<string, { taxRateName: string; taxRate: number; taxableAmount: Decimal; taxAmount: Decimal }>();

    for (const payment of payments) {
      const invoice = payment.invoice;
      if (!invoice) continue;
      const invoiceTotal = new Decimal(invoice.total);
      const invoiceTax = new Decimal(invoice.tax ?? 0);
      if (invoiceTax.lte(0) || invoiceTotal.lte(0)) continue;

      const paymentAmount = new Decimal(payment.amount);
      const paymentShare = paymentAmount.div(invoiceTotal);
      const taxForPayment = invoiceTax.times(paymentShare).toDecimalPlaces(2);
      const taxableForPayment = paymentAmount.minus(taxForPayment).toDecimalPlaces(2);

      const taxRateName = invoice.taxRate?.name ?? 'Standard VAT';
      const taxRatePercent = invoice.taxRate?.rate != null ? Number(invoice.taxRate.rate) : 0;

      const existing = outputVatMap.get(taxRateName);
      if (existing) {
        existing.taxableAmount = existing.taxableAmount.plus(taxableForPayment);
        existing.taxAmount = existing.taxAmount.plus(taxForPayment);
      } else {
        outputVatMap.set(taxRateName, { taxRateName, taxRate: taxRatePercent, taxableAmount: taxableForPayment, taxAmount: taxForPayment });
      }
    }

    const outputVatLines = Array.from(outputVatMap.values()).map((l) => ({
      taxRateName: l.taxRateName,
      taxRate: l.taxRate,
      taxableAmount: l.taxableAmount.toDecimalPlaces(2).toNumber(),
      taxAmount: l.taxAmount.toDecimalPlaces(2).toNumber(),
    }));

    const totalOutputTaxable = outputVatLines.reduce((s, l) => s.plus(l.taxableAmount), new Decimal(0)).toDecimalPlaces(2).toNumber();
    const totalOutputVat = outputVatLines.reduce((s, l) => s.plus(l.taxAmount), new Decimal(0)).toDecimalPlaces(2).toNumber();

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
    const value = new Decimal(row.qty).times(row.unitCost).toDecimalPlaces(2).toNumber();
    buckets[bucket] += row.qty;
    bucketValue[bucket] += value;
    items.push({ ...row, daysOnHand, bucket, value });
  }

  return {
    asOfDate: asOf.toISOString().split('T')[0],
    bucketSummary: {
      '0-30':  { qty: buckets['0-30'],  value: new Decimal(bucketValue['0-30']).toDecimalPlaces(2).toNumber() },
      '31-60': { qty: buckets['31-60'], value: new Decimal(bucketValue['31-60']).toDecimalPlaces(2).toNumber() },
      '61-90': { qty: buckets['61-90'], value: new Decimal(bucketValue['61-90']).toDecimalPlaces(2).toNumber() },
      '90+':   { qty: buckets['90+'],   value: new Decimal(bucketValue['90+']).toDecimalPlaces(2).toNumber() },
    },
    totalQty: items.reduce((s, i) => s + i.qty, 0),
    totalValue: items.reduce((s, i) => s.plus(i.value), new Decimal(0)).toDecimalPlaces(2).toNumber(),
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

    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);
    const rows = lines.map((l: any) => {
      const debit = new Decimal(l.debit ?? 0).toDecimalPlaces(2).toNumber();
      const credit = new Decimal(l.credit ?? 0).toDecimalPlaces(2).toNumber();
      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);
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

    const totalDebitNum = totalDebit.toDecimalPlaces(2).toNumber();
    const totalCreditNum = totalCredit.toDecimalPlaces(2).toNumber();
    return { category: { id: category.id, name: category.name }, lines: rows, totalDebit: totalDebitNum, totalCredit: totalCreditNum, net: totalCredit.minus(totalDebit).toDecimalPlaces(2).toNumber() };
  });
}

export interface BenfordDigitResult {
  digit: number;
  expected: number;        // Benford expected probability 0–1
  actual: number;          // observed probability 0–1
  count: number;
  zScore: number;          // |observed - expected| / sqrt(expected*(1-expected)/n)
  flagged: boolean;        // |z| > 1.96 (95% confidence)
}

export interface BenfordAnalysisResult {
  totalTransactions: number;
  digits: BenfordDigitResult[];
  chiSquare: number;
  overallFlagged: boolean; // chi-square > 15.51 (df=8, p<0.05)
  startDate?: string;
  endDate?: string;
}

// Benford's Law: P(d) = log10(1 + 1/d)
const BENFORD_EXPECTED: Record<number, number> = Object.fromEntries(
  [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => [d, Math.log10(1 + 1 / d)])
);

export async function getBenfordAnalysis(startDate?: string, endDate?: string): Promise<BenfordAnalysisResult> {
  if (startDate) validateDateFormat(startDate, 'startDate');
  if (endDate) validateDateFormat(endDate, 'endDate');

  const { tenantId } = requireTenantContext();

  type DigitRow = { digit: string; cnt: string };

  const rows = (await withCurrentTenantDb(prisma, async (client) => {
    // Extract the leading digit from the absolute value of each non-zero line amount.
    // journal_entry_lines in the tenant schema uses debit/credit columns (not amount).
    // Exactly one of debit/credit is non-zero per line, so debit+credit gives the amount.
    const dateFilter = startDate || endDate
      ? `AND je.entry_date BETWEEN $1 AND $2`
      : '';
    const params: Date[] = [];
    if (startDate || endDate) {
      params.push(startDate ? new Date(startDate) : new Date('1900-01-01'));
      params.push(endDate ? new Date(endDate) : new Date('9999-12-31'));
    }

    return (client as any).$queryRawUnsafe(
      `SELECT
         SUBSTRING(LTRIM(CAST((jel.debit + jel.credit) AS TEXT), '0.'), 1, 1) AS digit,
         COUNT(*) AS cnt
       FROM journal_entry_lines jel
       JOIN journal_entries je ON je.id = jel.journal_entry_id
       WHERE je.status = 'POSTED'
         AND (jel.debit + jel.credit) <> 0
         ${dateFilter}
       GROUP BY digit
       ORDER BY digit`,
      ...params
    );
  })) as DigitRow[];

  // Build digit → count map, filter to valid leading digits 1–9
  const countMap: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
  for (const row of rows) {
    const d = parseInt(row.digit, 10);
    if (d >= 1 && d <= 9) countMap[d] = parseInt(row.cnt, 10);
  }

  const total = Object.values(countMap).reduce((s, c) => s + c, 0);

  const digits: BenfordDigitResult[] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
    const expected = BENFORD_EXPECTED[d];
    const count = countMap[d];
    const actual = total > 0 ? count / total : 0;
    const stdErr = total > 0 ? Math.sqrt((expected * (1 - expected)) / total) : 1;
    const zScore = stdErr > 0 ? Math.abs(actual - expected) / stdErr : 0;
    return { digit: d, expected: parseFloat(expected.toFixed(4)), actual: parseFloat(actual.toFixed(4)), count, zScore: parseFloat(zScore.toFixed(3)), flagged: zScore > 1.96 };
  });

  // Chi-square goodness-of-fit: sum((observed - expected)^2 / expected) across digits
  const chiSquare = total > 0
    ? digits.reduce((sum, d) => {
        const expectedCount = BENFORD_EXPECTED[d.digit] * total;
        return sum + Math.pow(d.count - expectedCount, 2) / expectedCount;
      }, 0)
    : 0;

  return {
    totalTransactions: total,
    digits,
    chiSquare: parseFloat(chiSquare.toFixed(3)),
    overallFlagged: chiSquare > 15.507, // chi-square critical value df=8, p=0.05
    startDate,
    endDate,
  };
}

// ─── Fraud Alert: Duplicate Payments ────────────────────────────────────────

export interface DuplicatePaymentGroup {
  vendorName: string | null;
  amount: string;
  paymentDate: string;
  count: number;
  paymentIds: string[];
}

/**
 * Flags groups of invoice payments that share the same vendor name, amount,
 * and payment date. Identical amount + payee + date appearing more than once
 * within the same tenant is a classic duplicate-payment indicator.
 */
export async function getDuplicatePayments(startDate?: string, endDate?: string): Promise<DuplicatePaymentGroup[]> {
  if (startDate) validateDateFormat(startDate, 'startDate');
  if (endDate) validateDateFormat(endDate, 'endDate');

  const { tenantId } = requireTenantContext();

  type DupRow = { vendor_name: string | null; amount: string; payment_date: string; cnt: string; payment_ids: string };

  const rows = (await withCurrentTenantDb(prisma, async (client) => {
    // InvoicePayment has no payment_date column; use created_at as the payment date proxy.
    const params: (string | Date)[] = [tenantId];
    let dateFilter = '';
    if (startDate || endDate) {
      params.push(startDate ? new Date(startDate) : new Date('1900-01-01'));
      params.push(endDate ? new Date(endDate) : new Date('9999-12-31'));
      dateFilter = `AND ip.created_at BETWEEN $2 AND $3`;
    }

    return (client as any).$queryRawUnsafe(
      `SELECT
         i.customer_name AS vendor_name,
         ip.amount::TEXT AS amount,
         ip.created_at::DATE::TEXT AS payment_date,
         COUNT(*) AS cnt,
         STRING_AGG(ip.id::TEXT, ',' ORDER BY ip.created_at) AS payment_ids
       FROM invoice_payments ip
       JOIN invoices i ON i.id = ip.invoice_id
       WHERE ip.tenant_id = $1
         ${dateFilter}
       GROUP BY i.customer_name, ip.amount, ip.created_at::DATE
       HAVING COUNT(*) > 1
       ORDER BY cnt DESC, payment_date DESC`,
      ...params
    );
  })) as DupRow[];

  return rows.map((r) => ({
    vendorName: r.vendor_name,
    amount: r.amount,
    paymentDate: r.payment_date,
    count: parseInt(r.cnt, 10),
    paymentIds: r.payment_ids ? r.payment_ids.split(',') : [],
  }));
}

// ─── Fraud Alert: Round-Amount Transactions ──────────────────────────────────

export interface RoundAmountTransaction {
  journalEntryId: string;
  lineId: string;
  amount: string;
  description: string | null;
  entryDate: string;
  accountName: string | null;
}

/**
 * Returns posted journal entry lines whose absolute amount is a round multiple
 * of `roundingThreshold` (default 100) and >= `minAmount` (default 500).
 * Round amounts in accounting (e.g. GH₵1,000, GH₵5,000) warrant scrutiny
 * as they often indicate estimates, fabrications, or expense-splitting schemes.
 */
export async function getRoundAmountTransactions(
  minAmount: number = 500,
  roundingThreshold: number = 100,
  startDate?: string,
  endDate?: string
): Promise<RoundAmountTransaction[]> {
  if (startDate) validateDateFormat(startDate, 'startDate');
  if (endDate) validateDateFormat(endDate, 'endDate');

  const { tenantId } = requireTenantContext();

  type RoundRow = { journal_entry_id: string; line_id: string; amount: string; description: string | null; entry_date: string; account_name: string | null };

  const rows = (await withCurrentTenantDb(prisma, async (client) => {
    // journal_entry_lines in the tenant schema uses debit/credit columns (not amount/tenant_id).
    // Exactly one of debit/credit is non-zero per line, so debit+credit gives the line value.
    const params: (number | Date)[] = [minAmount, roundingThreshold];
    let dateFilter = '';
    if (startDate || endDate) {
      params.push(startDate ? new Date(startDate) : new Date('1900-01-01'));
      params.push(endDate ? new Date(endDate) : new Date('9999-12-31'));
      dateFilter = `AND je.entry_date BETWEEN $3 AND $4`;
    }

    return (client as any).$queryRawUnsafe(
      `SELECT
         jel.journal_entry_id,
         jel.id AS line_id,
         (jel.debit + jel.credit)::TEXT AS amount,
         jel.description,
         je.entry_date::DATE::TEXT AS entry_date,
         a.name AS account_name
       FROM journal_entry_lines jel
       JOIN journal_entries je ON je.id = jel.journal_entry_id
       LEFT JOIN accounts a ON a.id = jel.account_id
       WHERE je.status = 'POSTED'
         AND (jel.debit + jel.credit) >= $1
         AND MOD((jel.debit + jel.credit)::NUMERIC, $2::NUMERIC) = 0
         ${dateFilter}
       ORDER BY je.entry_date DESC, (jel.debit + jel.credit) DESC
       LIMIT 500`,
      ...params
    );
  })) as RoundRow[];

  return rows.map((r) => ({
    journalEntryId: r.journal_entry_id,
    lineId: r.line_id,
    amount: r.amount,
    description: r.description,
    entryDate: r.entry_date,
    accountName: r.account_name,
  }));
}
