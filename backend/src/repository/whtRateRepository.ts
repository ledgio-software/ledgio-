import { PrismaClient } from '@prisma/client';

export interface WhtRateRecord {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  rate: string;
  accountId: string | null;
  isActive: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWhtRateData {
  name: string;
  code: string;
  rate: number;
  accountId?: string | null;
  isActive?: boolean;
  description?: string | null;
}

export async function listWhtRates(prisma: PrismaClient, tenantId: string): Promise<WhtRateRecord[]> {
  return (prisma as any).whtRate.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getWhtRateById(prisma: PrismaClient, tenantId: string, id: string): Promise<WhtRateRecord | null> {
  return (prisma as any).whtRate.findFirst({ where: { id, tenantId } });
}

export async function getWhtRateByCode(prisma: PrismaClient, tenantId: string, code: string): Promise<WhtRateRecord | null> {
  return (prisma as any).whtRate.findFirst({ where: { tenantId, code } });
}

export async function createWhtRate(
  prisma: PrismaClient,
  tenantId: string,
  data: CreateWhtRateData
): Promise<WhtRateRecord> {
  return (prisma as any).whtRate.create({
    data: {
      tenantId,
      name: data.name.trim(),
      code: data.code.trim(),
      rate: data.rate,
      accountId: data.accountId ?? null,
      isActive: data.isActive !== undefined ? data.isActive : true,
      description: data.description ?? null,
    },
  });
}

export async function updateWhtRate(
  prisma: PrismaClient,
  tenantId: string,
  id: string,
  data: Partial<CreateWhtRateData>
): Promise<WhtRateRecord | null> {
  const existing = await getWhtRateById(prisma, tenantId, id);
  if (!existing) return null;

  return (prisma as any).whtRate.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.code !== undefined ? { code: data.code.trim() } : {}),
      ...(data.rate !== undefined ? { rate: data.rate } : {}),
      ...(data.accountId !== undefined ? { accountId: data.accountId } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
    },
  });
}

export async function countBillsUsingWhtRate(prisma: PrismaClient, tenantId: string, id: string): Promise<number> {
  return (prisma as any).vendorBill.count({ where: { tenantId, whtRateId: id } });
}

export async function deleteWhtRate(prisma: PrismaClient, tenantId: string, id: string): Promise<boolean> {
  const existing = await getWhtRateById(prisma, tenantId, id);
  if (!existing) return false;
  await (prisma as any).whtRate.delete({ where: { id } });
  return true;
}
