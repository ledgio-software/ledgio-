import { prisma } from '../config/db';
import * as pdcRepository from '../repository/pdcRepository';
import { PDCRecord } from '../repository/pdcRepository';
import * as accountRepository from '../repository/accountRepository';
import * as journalEntryService from './journalEntryService';
import { AuditActor } from './auditLogService';
import { withCurrentTenantDb } from '../database/tenantClient';

export class PDCServiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'PDCServiceError';
    this.statusCode = statusCode;
  }
}

export async function listPDCs(
  tenantId: string,
  filter: { type?: string; status?: string } = {}
): Promise<PDCRecord[]> {
  return pdcRepository.listPDCs(prisma, tenantId, filter);
}

export async function getPDCById(tenantId: string, id: string): Promise<PDCRecord | null> {
  return pdcRepository.getPDCById(prisma, tenantId, id);
}

export interface CreatePDCInput {
  type: 'RECEIVABLE' | 'PAYABLE';
  partyName: string;
  chequeNumber: string;
  bankName: string;
  amount: number;
  currency?: string;
  dueDate: string;
  invoiceId?: string;
  billId?: string;
  notes?: string;
  postJournal?: boolean;
}

export async function createPDC(
  tenantId: string,
  input: CreatePDCInput,
  actor?: AuditActor
): Promise<PDCRecord> {
  if (!input.type || !['RECEIVABLE', 'PAYABLE'].includes(input.type)) {
    throw new PDCServiceError('Type must be RECEIVABLE or PAYABLE.');
  }
  if (!input.partyName?.trim()) throw new PDCServiceError('Party name is required.');
  if (!input.chequeNumber?.trim()) throw new PDCServiceError('Cheque number is required.');
  if (!input.bankName?.trim()) throw new PDCServiceError('Bank name is required.');
  if (!input.amount || input.amount <= 0) throw new PDCServiceError('Amount must be positive.');
  if (!input.dueDate) throw new PDCServiceError('Due date is required.');

  let receiptJournalId: string | null = null;

  if (input.postJournal) {
    const accounts = await withCurrentTenantDb(prisma, (client) =>
      accountRepository.listAccounts(client)
    );

    if (input.type === 'RECEIVABLE') {
      const pdcReceivableAcc = accountRepository.resolveDefaultAccount(accounts, 'PDC_RECEIVABLE');
      const revenueAcc = accountRepository.resolveDefaultAccount(accounts, 'REVENUE');
      if (!pdcReceivableAcc || !revenueAcc) {
        throw new PDCServiceError(
          'PDC Receivable and Revenue accounts must be configured to post the receipt journal.',
          422
        );
      }
      const journal = await journalEntryService.createJournalEntry(
        {
          description: `PDC Receipt - ${input.chequeNumber} from ${input.partyName}`,
          entryDate: new Date().toISOString().split('T')[0],
          status: 'POSTED',
          lines: [
            { accountId: pdcReceivableAcc.id, debit: input.amount, credit: 0, description: `PDC Receivable - ${input.chequeNumber}` },
            { accountId: revenueAcc.id, debit: 0, credit: input.amount, description: `PDC Receipt from ${input.partyName}` },
          ],
        },
        actor
      );
      receiptJournalId = journal.id;
    } else {
      const expenseAcc = accountRepository.resolveDefaultAccount(accounts, 'EXPENSE');
      const pdcPayableAcc = accountRepository.resolveDefaultAccount(accounts, 'PDC_PAYABLE');
      if (!expenseAcc || !pdcPayableAcc) {
        throw new PDCServiceError(
          'Expense and PDC Payable accounts must be configured to post the issuance journal.',
          422
        );
      }
      const journal = await journalEntryService.createJournalEntry(
        {
          description: `PDC Issued - ${input.chequeNumber} to ${input.partyName}`,
          entryDate: new Date().toISOString().split('T')[0],
          status: 'POSTED',
          lines: [
            { accountId: expenseAcc.id, debit: input.amount, credit: 0, description: `Expense via PDC - ${input.chequeNumber}` },
            { accountId: pdcPayableAcc.id, debit: 0, credit: input.amount, description: `PDC Payable to ${input.partyName}` },
          ],
        },
        actor
      );
      receiptJournalId = journal.id;
    }
  }

  return pdcRepository.createPDC(prisma, {
    tenantId,
    type: input.type,
    partyName: input.partyName.trim(),
    chequeNumber: input.chequeNumber.trim(),
    bankName: input.bankName.trim(),
    amount: input.amount,
    currency: input.currency,
    dueDate: input.dueDate,
    invoiceId: input.invoiceId ?? null,
    billId: input.billId ?? null,
    notes: input.notes ?? null,
    receiptJournalId,
  });
}

export async function depositPDC(
  tenantId: string,
  id: string,
  actor?: AuditActor
): Promise<PDCRecord> {
  const pdc = await pdcRepository.getPDCById(prisma, tenantId, id);
  if (!pdc) throw new PDCServiceError('Post-dated cheque not found.', 404);
  if (pdc.status !== 'PENDING') {
    throw new PDCServiceError(`Cannot deposit a cheque with status "${pdc.status}". Only PENDING cheques can be deposited.`);
  }

  const accounts = await withCurrentTenantDb(prisma, (client) =>
    accountRepository.listAccounts(client)
  );
  const cashAcc = accountRepository.resolveDefaultAccount(accounts, 'CASH');

  let depositJournalId: string | null = null;

  if (pdc.type === 'RECEIVABLE') {
    const pdcReceivableAcc = accountRepository.resolveDefaultAccount(accounts, 'PDC_RECEIVABLE');
    if (cashAcc && pdcReceivableAcc) {
      const journal = await journalEntryService.createJournalEntry(
        {
          description: `PDC Deposit - ${pdc.chequeNumber} from ${pdc.partyName}`,
          entryDate: new Date().toISOString().split('T')[0],
          status: 'POSTED',
          lines: [
            { accountId: cashAcc.id, debit: Number(pdc.amount), credit: 0, description: `Cash from PDC - ${pdc.chequeNumber}` },
            { accountId: pdcReceivableAcc.id, debit: 0, credit: Number(pdc.amount), description: `PDC Cleared - ${pdc.chequeNumber}` },
          ],
        },
        actor
      );
      depositJournalId = journal.id;
    }
  } else {
    const pdcPayableAcc = accountRepository.resolveDefaultAccount(accounts, 'PDC_PAYABLE');
    if (cashAcc && pdcPayableAcc) {
      const journal = await journalEntryService.createJournalEntry(
        {
          description: `PDC Cleared - ${pdc.chequeNumber} to ${pdc.partyName}`,
          entryDate: new Date().toISOString().split('T')[0],
          status: 'POSTED',
          lines: [
            { accountId: pdcPayableAcc.id, debit: Number(pdc.amount), credit: 0, description: `PDC Payable Cleared - ${pdc.chequeNumber}` },
            { accountId: cashAcc.id, debit: 0, credit: Number(pdc.amount), description: `Cash Payment - ${pdc.chequeNumber}` },
          ],
        },
        actor
      );
      depositJournalId = journal.id;
    }
  }

  return pdcRepository.updatePDCStatus(prisma, id, 'DEPOSITED', depositJournalId);
}

export async function bouncePDC(
  tenantId: string,
  id: string,
  actor?: AuditActor
): Promise<PDCRecord> {
  const pdc = await pdcRepository.getPDCById(prisma, tenantId, id);
  if (!pdc) throw new PDCServiceError('Post-dated cheque not found.', 404);
  if (pdc.status !== 'PENDING') {
    throw new PDCServiceError(`Cannot bounce a cheque with status "${pdc.status}". Only PENDING cheques can be bounced.`);
  }

  // Post reversal journal only for RECEIVABLE PDCs that had a receipt journal.
  if (pdc.type === 'RECEIVABLE' && pdc.receiptJournalId) {
    const accounts = await withCurrentTenantDb(prisma, (client) =>
      accountRepository.listAccounts(client)
    );
    const pdcReceivableAcc = accountRepository.resolveDefaultAccount(accounts, 'PDC_RECEIVABLE');
    const revenueAcc = accountRepository.resolveDefaultAccount(accounts, 'REVENUE');
    if (pdcReceivableAcc && revenueAcc) {
      await journalEntryService.createJournalEntry(
        {
          description: `PDC Bounce Reversal - ${pdc.chequeNumber} from ${pdc.partyName}`,
          entryDate: new Date().toISOString().split('T')[0],
          status: 'POSTED',
          lines: [
            { accountId: revenueAcc.id, debit: Number(pdc.amount), credit: 0, description: `PDC Bounce - ${pdc.chequeNumber}` },
            { accountId: pdcReceivableAcc.id, debit: 0, credit: Number(pdc.amount), description: `PDC Bounced - ${pdc.chequeNumber}` },
          ],
        },
        actor
      );
    }
  }

  return pdcRepository.updatePDCStatus(prisma, id, 'BOUNCED');
}

export async function cancelPDC(tenantId: string, id: string): Promise<PDCRecord> {
  const pdc = await pdcRepository.getPDCById(prisma, tenantId, id);
  if (!pdc) throw new PDCServiceError('Post-dated cheque not found.', 404);
  if (pdc.status !== 'PENDING') {
    throw new PDCServiceError(`Cannot cancel a cheque with status "${pdc.status}". Only PENDING cheques can be cancelled.`);
  }
  return pdcRepository.updatePDCStatus(prisma, id, 'CANCELLED');
}
