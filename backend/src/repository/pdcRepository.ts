import { PrismaClient } from '@prisma/client';

export interface PDCRecord {
  id: string;
  tenantId: string;
  type: 'RECEIVABLE' | 'PAYABLE';
  partyName: string;
  chequeNumber: string;
  bankName: string;
  amount: string;
  currency: string;
  dueDate: Date;
  status: 'PENDING' | 'DEPOSITED' | 'BOUNCED' | 'CANCELLED';
  invoiceId: string | null;
  billId: string | null;
  receiptJournalId: string | null;
  depositJournalId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: any): PDCRecord {
  return {
    id: row.id,
    tenantId: row.tenantId ?? row.tenant_id,
    type: row.type,
    partyName: row.partyName ?? row.party_name,
    chequeNumber: row.chequeNumber ?? row.cheque_number,
    bankName: row.bankName ?? row.bank_name,
    amount: String(row.amount),
    currency: row.currency,
    dueDate: new Date(row.dueDate ?? row.due_date),
    status: row.status,
    invoiceId: row.invoiceId ?? row.invoice_id ?? null,
    billId: row.billId ?? row.bill_id ?? null,
    receiptJournalId: row.receiptJournalId ?? row.receipt_journal_id ?? null,
    depositJournalId: row.depositJournalId ?? row.deposit_journal_id ?? null,
    notes: row.notes ?? null,
    createdAt: new Date(row.createdAt ?? row.created_at),
    updatedAt: new Date(row.updatedAt ?? row.updated_at),
  };
}

export async function listPDCs(
  prisma: PrismaClient,
  tenantId: string,
  filter: { type?: string; status?: string } = {}
): Promise<PDCRecord[]> {
  const where: any = { tenantId };
  if (filter.type) where.type = filter.type;
  if (filter.status) where.status = filter.status;
  const rows = await (prisma as any).postDatedCheque.findMany({
    where,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
  });
  return rows.map(mapRow);
}

export async function getPDCById(prisma: PrismaClient, tenantId: string, id: string): Promise<PDCRecord | null> {
  const row = await (prisma as any).postDatedCheque.findFirst({ where: { id, tenantId } });
  return row ? mapRow(row) : null;
}

export interface CreatePDCData {
  tenantId: string;
  type: 'RECEIVABLE' | 'PAYABLE';
  partyName: string;
  chequeNumber: string;
  bankName: string;
  amount: number;
  currency?: string;
  dueDate: Date | string;
  invoiceId?: string | null;
  billId?: string | null;
  notes?: string | null;
  receiptJournalId?: string | null;
}

export async function createPDC(prisma: PrismaClient, data: CreatePDCData): Promise<PDCRecord> {
  const row = await (prisma as any).postDatedCheque.create({
    data: {
      tenantId: data.tenantId,
      type: data.type,
      partyName: data.partyName,
      chequeNumber: data.chequeNumber,
      bankName: data.bankName,
      amount: data.amount,
      currency: data.currency ?? 'GHS',
      dueDate: new Date(data.dueDate),
      status: 'PENDING',
      invoiceId: data.invoiceId ?? null,
      billId: data.billId ?? null,
      notes: data.notes ?? null,
      receiptJournalId: data.receiptJournalId ?? null,
    },
  });
  return mapRow(row);
}

export async function updatePDCStatus(
  prisma: PrismaClient,
  id: string,
  status: 'DEPOSITED' | 'BOUNCED' | 'CANCELLED',
  journalId?: string | null
): Promise<PDCRecord> {
  const updateData: any = { status, updatedAt: new Date() };
  if (journalId) {
    updateData.depositJournalId = journalId;
  }
  const row = await (prisma as any).postDatedCheque.update({
    where: { id },
    data: updateData,
  });
  return mapRow(row);
}
