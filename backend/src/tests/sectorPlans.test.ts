import { Request, Response } from 'express';
import {
  SECTOR_SLUGS,
  getPlansForSector,
  getSectorPlan,
  sectorFromOrgType,
  isValidSector,
} from '../config/sectorPlans';
import { planName, seatLimitForTier, requireTier } from '../middleware/tierEnforcementMiddleware';

describe('sector plan catalogue', () => {
  it('defines three tiers for every sector', () => {
    for (const sector of SECTOR_SLUGS) {
      expect(getPlansForSector(sector).map((p) => p.tier)).toEqual([1, 2, 3]);
    }
  });

  it('prices sectors as published on ledgio-hub', () => {
    expect(getPlansForSector('retail').map((p) => p.priceGhs)).toEqual([105, 205, 350]);
    expect(getPlansForSector('pharmacy').map((p) => p.priceGhs)).toEqual([350, 600, 900]);
    expect(getPlansForSector('churches-ngos').map((p) => p.priceGhs)).toEqual([105, 305, 510]);
    expect(getPlansForSector('enterprise').map((p) => p.priceGhs)).toEqual([350, 600, null]);
  });

  it('falls back to retail for unknown sectors', () => {
    expect(isValidSector('casino')).toBe(false);
    expect(getPlansForSector('casino')).toBe(getPlansForSector('retail'));
    expect(getSectorPlan(undefined, 2)?.priceGhs).toBe(205);
  });

  it('maps legacy orgType values to sectors', () => {
    expect(sectorFromOrgType('PHARMACY')).toBe('pharmacy');
    expect(sectorFromOrgType('NONPROFIT')).toBe('churches-ngos');
    expect(sectorFromOrgType('SERVICE')).toBe('professional-services');
    expect(sectorFromOrgType('BUSINESS')).toBe('retail');
    expect(sectorFromOrgType(null)).toBe('retail');
  });
});

describe('sector-aware tier helpers', () => {
  it('uses sector plan names', () => {
    expect(planName(2, 'retail')).toBe('Standard');
    expect(planName(3, 'pharmacy')).toBe('Pro');
    expect(planName(2, 'churches-ngos')).toBe('Business');
    expect(planName(3, 'enterprise')).toBe('Enterprise');
    expect(planName(2)).toBe('Business');
  });

  it('uses sector seat limits', () => {
    expect(seatLimitForTier(1, 'retail')).toBe(3);
    expect(seatLimitForTier(1, 'enterprise')).toBe(10);
    expect(seatLimitForTier(2, 'enterprise')).toBe(Infinity);
    expect(seatLimitForTier(2)).toBe(10);
  });

  it('lets a sector Starter plan through for its unlocked Business features only', () => {
    const run = (sector: string, feature: string, requiredTier = 2) => {
      const next = jest.fn();
      const res = { status: jest.fn().mockReturnValue({ json: jest.fn() }) } as unknown as Response;
      const req = {
        headers: {},
        originalUrl: '/x',
        tenantContext: { tenantId: 't1', tenantSchema: 's1', tenantTier: 1, tenantSector: sector },
      } as unknown as Request;
      requireTier(requiredTier, feature)(req, res, next);
      return next.mock.calls.length === 1;
    };

    expect(run('manufacturing', 'Job Costing')).toBe(true);
    expect(run('construction', 'Job Costing')).toBe(true);
    expect(run('churches-ngos', 'Bank Reconciliation')).toBe(true);
    expect(run('retail', 'Job Costing')).toBe(false);
    expect(run('manufacturing', 'Payroll')).toBe(false);
    expect(run('enterprise', 'Approval Workflows', 3)).toBe(false);
  });

  it('names the sector plan in the 403 upgrade response', () => {
    const json = jest.fn();
    const res = { status: jest.fn().mockReturnValue({ json }) } as unknown as Response;
    const req = {
      headers: {},
      originalUrl: '/api/v1/payroll',
      tenantContext: { tenantId: 't1', tenantSchema: 's1', tenantTier: 1, tenantSector: 'pharmacy' },
    } as unknown as Request;
    const next = jest.fn();

    requireTier(2, 'Payroll')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      currentPlanName: 'Starter',
      requiredPlanName: 'Standard',
      error: 'Payroll requires the Standard plan or higher. Your business is currently on the Starter plan.',
    }));
  });
});
