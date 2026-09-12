import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';

const router = Router();

/**
 * GET /admin/schema-diff
 * Shows applied vs pending Prisma migrations.
 * Also lists tenants whose schema field is set, so Kingsley can correlate
 * which tenants live on which DB schema version.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // Query Prisma's own migrations tracking table
    const migrations = await prisma.$queryRaw<
      Array<{ id: string; migration_name: string; finished_at: Date | null; started_at: Date; rolled_back_at: Date | null; applied_steps_count: number; checksum: string }>
    >`SELECT id, migration_name, finished_at, started_at, rolled_back_at, applied_steps_count, checksum FROM "_prisma_migrations" ORDER BY started_at DESC`;

    const applied = migrations.filter((m) => m.finished_at && !m.rolled_back_at);
    const failed = migrations.filter((m) => m.rolled_back_at || (!m.finished_at && m.applied_steps_count === 0));
    const inProgress = migrations.filter((m) => !m.finished_at && !m.rolled_back_at && m.applied_steps_count > 0);

    // Tenant schema field — shows which named DB schema each tenant is mapped to
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true, slug: true, schema: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const latestApplied = applied[0] ?? null;

    res.json({
      success: true,
      data: {
        summary: {
          total: migrations.length,
          applied: applied.length,
          failed: failed.length,
          inProgress: inProgress.length,
          latestMigration: latestApplied ? {
            name: latestApplied.migration_name,
            appliedAt: latestApplied.finished_at,
          } : null,
        },
        migrations: migrations.map((m) => ({
          name: m.migration_name,
          appliedAt: m.finished_at,
          startedAt: m.started_at,
          rolledBackAt: m.rolled_back_at,
          stepsApplied: m.applied_steps_count,
          status: m.rolled_back_at ? 'ROLLED_BACK'
            : m.finished_at ? 'APPLIED'
            : m.applied_steps_count > 0 ? 'IN_PROGRESS'
            : 'FAILED',
        })),
        tenantSchemas: tenants.map((t) => ({
          tenantId: t.id,
          name: t.name,
          slug: t.slug,
          schema: t.schema,
          createdAt: t.createdAt,
        })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
