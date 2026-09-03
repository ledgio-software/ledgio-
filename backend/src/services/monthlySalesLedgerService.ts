import { prisma } from '../config/db';
import { withCurrentTenantDb } from '../database/tenantClient';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';

export interface LedgerLine {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface LedgerTransaction {
  id: string;
  type: 'POS' | 'INVOICE';
  ref: string;
  date: string;
  customerName: string | null;
  companyName: string | null;
  paymentMethod: string | null;
  status: string;
  total: number;
  lines: LedgerLine[];
}

export interface DaySummary {
  date: string;
  transactions: LedgerTransaction[];
  dayTotal: number;
}

export interface MonthLedger {
  year: number;
  month: number;
  currency: string;
  totalSales: number;
  totalCashSales: number;
  totalCreditSales: number;
  transactionCount: number;
  days: DaySummary[];
  topProducts: { name: string; qty: number; revenue: number }[];
}

export interface MonthCloseRecord {
  id: string;
  year: number;
  month: number;
  closedAt: string;
  closedByName: string | null;
  totalSales: number;
  totalCashSales: number;
  totalCreditSales: number;
  transactionCount: number;
  topProducts: { name: string; qty: number; revenue: number }[];
  summary: Record<string, unknown>;
  rank?: number;
}

export async function getMonthlySalesLedger(
  tenantId: string,
  year: number,
  month: number
): Promise<MonthLedger> {
  return withCurrentTenantDb(prisma, async (db) => {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    // Get currency from public Tenant record
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const currency = tenant?.baseCurrency ?? 'GHS';

    const [cashSales, invoices] = await Promise.all([
      db.cashSale.findMany({
        where: { tenantId, createdAt: { gte: start, lt: end }, status: 'COMPLETED' },
        include: { lines: true },
        orderBy: { createdAt: 'asc' },
      }),
      db.invoice.findMany({
        where: { tenantId, issueDate: { gte: start, lt: end }, status: { not: 'VOIDED' } },
        include: { items: true, customer: true },
        orderBy: { issueDate: 'asc' },
      }),
    ]);

    const txns: LedgerTransaction[] = [];

    for (const sale of cashSales) {
      txns.push({
        id: sale.id,
        type: 'POS',
        ref: sale.receiptNo,
        date: sale.createdAt.toISOString(),
        customerName: (sale as any).customerName ?? null,
        companyName: null,
        paymentMethod: sale.paymentMethod,
        status: sale.status,
        total: Number(sale.amount),
        lines: sale.lines.map((l) => ({
          description: l.itemName,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          lineTotal: Number(l.lineTotal),
        })),
      });
    }

    for (const inv of invoices) {
      txns.push({
        id: inv.id,
        type: 'INVOICE',
        ref: inv.invoiceNumber,
        date: inv.issueDate.toISOString(),
        customerName: inv.customer?.name ?? null,
        companyName: (inv.customer as any)?.companyName ?? null,
        paymentMethod: null,
        status: inv.status,
        total: Number(inv.total),
        lines: inv.items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.amount),
        })),
      });
    }

    txns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const dayMap = new Map<string, LedgerTransaction[]>();
    for (const t of txns) {
      const day = t.date.split('T')[0];
      if (!dayMap.has(day)) dayMap.set(day, []);
      dayMap.get(day)!.push(t);
    }

    const days: DaySummary[] = [];
    for (const [date, transactions] of dayMap) {
      days.push({
        date,
        transactions,
        dayTotal: transactions.reduce((s, t) => s + t.total, 0),
      });
    }

    const productMap = new Map<string, { qty: number; revenue: number }>();
    for (const t of txns) {
      for (const l of t.lines) {
        const existing = productMap.get(l.description) ?? { qty: 0, revenue: 0 };
        productMap.set(l.description, {
          qty: existing.qty + l.quantity,
          revenue: existing.revenue + l.lineTotal,
        });
      }
    }
    const topProducts = [...productMap.entries()]
      .map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const totalCashSales = cashSales.reduce((s, c) => s + Number(c.amount), 0);
    const totalCreditSales = invoices.reduce((s, i) => s + Number(i.total), 0);

    return {
      year,
      month,
      currency,
      totalSales: totalCashSales + totalCreditSales,
      totalCashSales,
      totalCreditSales,
      transactionCount: txns.length,
      days,
      topProducts,
    };
  });
}

export async function closeMonth(
  tenantId: string,
  year: number,
  month: number,
  userId: string | null,
  userName: string | null
): Promise<MonthCloseRecord> {
  const ledger = await getMonthlySalesLedger(tenantId, year, month);

  return withCurrentTenantDb(prisma, async (db) => {
    const priorYear = month === 1 ? year - 1 : year;
    const priorMonth = month === 1 ? 12 : month - 1;
    const prior = await db.monthClose.findUnique({
      where: { tenantId_year_month: { tenantId, year: priorYear, month: priorMonth } },
    });

    const summary: Prisma.InputJsonValue = {
      vsLastMonth: prior
        ? {
            totalSalesDiff: ledger.totalSales - Number(prior.totalSales),
            pctChange:
              Number(prior.totalSales) > 0
                ? ((ledger.totalSales - Number(prior.totalSales)) / Number(prior.totalSales)) * 100
                : null,
          }
        : null,
    };

    const topProductsJson: Prisma.InputJsonValue = ledger.topProducts as Prisma.InputJsonValue;

    const record = await db.monthClose.upsert({
      where: { tenantId_year_month: { tenantId, year, month } },
      update: {
        closedAt: new Date(),
        closedByUserId: userId,
        closedByName: userName,
        totalSales: new Decimal(ledger.totalSales),
        totalCashSales: new Decimal(ledger.totalCashSales),
        totalCreditSales: new Decimal(ledger.totalCreditSales),
        transactionCount: ledger.transactionCount,
        topProducts: topProductsJson,
        summary,
      },
      create: {
        tenantId,
        year,
        month,
        closedByUserId: userId,
        closedByName: userName,
        totalSales: new Decimal(ledger.totalSales),
        totalCashSales: new Decimal(ledger.totalCashSales),
        totalCreditSales: new Decimal(ledger.totalCreditSales),
        transactionCount: ledger.transactionCount,
        topProducts: topProductsJson,
        summary,
      },
    });

    return {
      id: record.id,
      year: record.year,
      month: record.month,
      closedAt: record.closedAt.toISOString(),
      closedByName: record.closedByName,
      totalSales: Number(record.totalSales),
      totalCashSales: Number(record.totalCashSales),
      totalCreditSales: Number(record.totalCreditSales),
      transactionCount: record.transactionCount,
      topProducts: record.topProducts as { name: string; qty: number; revenue: number }[],
      summary: record.summary as Record<string, unknown>,
    };
  });
}

export async function getMonthCloses(tenantId: string): Promise<MonthCloseRecord[]> {
  return withCurrentTenantDb(prisma, async (db) => {
    const records = await db.monthClose.findMany({
      where: { tenantId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    const sorted = [...records].sort((a, b) => Number(b.totalSales) - Number(a.totalSales));
    const rankMap = new Map(sorted.map((r, i) => [r.id, i + 1]));

    return records.map((r) => ({
      id: r.id,
      year: r.year,
      month: r.month,
      closedAt: r.closedAt.toISOString(),
      closedByName: r.closedByName,
      totalSales: Number(r.totalSales),
      totalCashSales: Number(r.totalCashSales),
      totalCreditSales: Number(r.totalCreditSales),
      transactionCount: r.transactionCount,
      topProducts: r.topProducts as { name: string; qty: number; revenue: number }[],
      summary: r.summary as Record<string, unknown>,
      rank: rankMap.get(r.id),
    }));
  });
}
