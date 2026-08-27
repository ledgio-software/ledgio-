import { prisma } from '../config/db';
import * as whtRateRepository from '../repository/whtRateRepository';
import * as accountRepository from '../repository/accountRepository';
import { WhtRateRecord, CreateWhtRateData } from '../repository/whtRateRepository';
import { recordAuditLogTx, diffFields, AuditActor } from './auditLogService';
import { withCurrentTenantDb } from '../database/tenantClient';

export class WhtRateServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'WhtRateServiceError';
    this.statusCode = statusCode;
  }
}

function validateRate(rate: number): void {
  if (typeof rate !== 'number' || Number.isNaN(rate) || rate <= 0 || rate > 1) {
    throw new WhtRateServiceError('WHT rate must be a number greater than 0 and at most 1 (e.g. 0.05 for 5%).', 400);
  }
}

export async function listWhtRates(tenantId: string): Promise<WhtRateRecord[]> {
  return whtRateRepository.listWhtRates(prisma, tenantId);
}

export async function getWhtRateById(tenantId: string, id: string): Promise<WhtRateRecord | null> {
  return whtRateRepository.getWhtRateById(prisma, tenantId, id);
}

export async function createWhtRate(tenantId: string, input: any, actor?: AuditActor): Promise<WhtRateRecord> {
  const { name, code, rate, accountId, isActive, description } = input;

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new WhtRateServiceError('WHT rate name is required.', 400);
  }
  if (!code || typeof code !== 'string' || !code.trim()) {
    throw new WhtRateServiceError('WHT rate code is required.', 400);
  }
  const numericRate = Number(rate);
  validateRate(numericRate);

  const existing = await whtRateRepository.getWhtRateByCode(prisma, tenantId, code.trim());
  if (existing) {
    throw new WhtRateServiceError(`WHT rate code "${code.trim()}" already exists.`, 409);
  }

  if (accountId) {
    await withCurrentTenantDb(prisma, async (client) => {
      const account = await accountRepository.getAccountById(client, accountId);
      if (!account) {
        throw new WhtRateServiceError(`Account with ID "${accountId}" does not exist.`, 400);
      }
    });
  }

  const data: CreateWhtRateData = { name, code, rate: numericRate, accountId: accountId ?? null, isActive, description };

  const created = await prisma.$transaction(async (tx) => {
    const created = await whtRateRepository.createWhtRate(tx as any, tenantId, data);
    await recordAuditLogTx(tx as any, {
      action: 'WHT_RATE.CREATED',
      entity: 'WhtRate',
      entityId: created.id,
      tenantId,
      actor,
      details: `WHT rate ${created.code} - ${created.name} (${(Number(created.rate) * 100).toFixed(2)}%) created.`,
    });
    return created;
  });

  return created;
}

export async function updateWhtRate(tenantId: string, id: string, input: any, actor?: AuditActor): Promise<WhtRateRecord> {
  const existing = await whtRateRepository.getWhtRateById(prisma, tenantId, id);
  if (!existing) {
    throw new WhtRateServiceError(`WHT rate with ID "${id}" not found.`, 404);
  }

  const data: Partial<CreateWhtRateData> = {};

  if (input.name !== undefined) {
    if (!input.name.trim()) throw new WhtRateServiceError('WHT rate name cannot be empty.', 400);
    data.name = input.name;
  }
  if (input.code !== undefined) {
    if (!input.code.trim()) throw new WhtRateServiceError('WHT rate code cannot be empty.', 400);
    if (input.code.trim() !== existing.code) {
      const dup = await whtRateRepository.getWhtRateByCode(prisma, tenantId, input.code.trim());
      if (dup) throw new WhtRateServiceError(`WHT rate code "${input.code.trim()}" already exists.`, 409);
    }
    data.code = input.code;
  }
  if (input.rate !== undefined) {
    const numericRate = Number(input.rate);
    validateRate(numericRate);
    data.rate = numericRate;
  }
  if (input.accountId !== undefined) data.accountId = input.accountId;
  if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);
  if (input.description !== undefined) data.description = input.description;

  if (data.accountId) {
    await withCurrentTenantDb(prisma, async (client) => {
      const account = await accountRepository.getAccountById(client, data.accountId as string);
      if (!account) {
        throw new WhtRateServiceError(`Account with ID "${data.accountId}" does not exist.`, 400);
      }
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await whtRateRepository.updateWhtRate(tx as any, tenantId, id, data);
    if (!updated) throw new WhtRateServiceError(`Failed to update WHT rate with ID "${id}".`, 500);
    await recordAuditLogTx(tx as any, {
      action: 'WHT_RATE.UPDATED',
      entity: 'WhtRate',
      entityId: updated.id,
      tenantId,
      actor,
      changes: diffFields(existing, updated, ['name', 'code', 'rate', 'accountId', 'isActive']),
    });
    return updated;
  });

  return updated;
}

export async function deleteWhtRate(tenantId: string, id: string, actor?: AuditActor): Promise<void> {
  const existing = await whtRateRepository.getWhtRateById(prisma, tenantId, id);
  if (!existing) {
    throw new WhtRateServiceError(`WHT rate with ID "${id}" not found.`, 404);
  }

  const usageCount = await whtRateRepository.countBillsUsingWhtRate(prisma, tenantId, id);
  if (usageCount > 0) {
    throw new WhtRateServiceError(
      `Cannot delete WHT rate "${existing.name}" because it is referenced by ${usageCount} vendor bill(s). Deactivate it instead.`,
      400
    );
  }

  await prisma.$transaction(async (tx) => {
    await whtRateRepository.deleteWhtRate(tx as any, tenantId, id);
    await recordAuditLogTx(tx as any, {
      action: 'WHT_RATE.DELETED',
      entity: 'WhtRate',
      entityId: id,
      tenantId,
      actor,
      details: `WHT rate ${existing.code} - ${existing.name} deleted.`,
    });
  });
}
