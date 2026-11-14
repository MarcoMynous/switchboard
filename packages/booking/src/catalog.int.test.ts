import { afterAll, describe, expect, it } from 'vitest';
import { getPublicCatalog, resolveService, slugify } from './catalog.ts';
import { connect, makeFixture } from './test-support/fixtures.ts';

const { pool, db } = connect(5);
afterAll(() => pool.end());

describe('slugify', () => {
  it('makes URL-friendly service names', () => {
    expect(slugify('Low cut')).toBe('low-cut');
    expect(slugify('Classic Fade & Beard Sculpt')).toBe('classic-fade-beard-sculpt');
    expect(slugify('  VIP Dreadlocks Retwist & Wash ')).toBe('vip-dreadlocks-retwist-wash');
    expect(slugify('Crème brûlée_treatment')).toBe('creme-brulee-treatment');
  });
});

describe('getPublicCatalog', () => {
  it('returns the business, its services (cheapest first) and active staff with what they do', async () => {
    const f = await makeFixture(db, { staffCount: 2 });
    await pool.query(`UPDATE staff SET active = false WHERE id = $1`, [f.staffIds[1]]);
    const c = await getPublicCatalog(db, f.slug);
    expect(c?.business).toMatchObject({
      id: f.businessId,
      slug: f.slug,
      timezone: 'Africa/Lagos',
      advanceDays: 14,
    });
    expect(c?.services.map((s) => [s.slug, s.priceKobo, s.depositType])).toEqual([
      ['beard-sculpt', 250_000, 'none'],
      ['low-cut', 300_000, 'fixed'],
      ['braids', 1_500_000, 'fixed'],
    ]);
    expect(c?.staff).toEqual([
      {
        id: f.staffIds[0],
        name: 'Barber A',
        roleTitle: 'Staff Provider',
        serviceIds: expect.arrayContaining([f.depositServiceId, f.longServiceId, f.freeServiceId]),
      },
    ]);
  });

  it('handles a business with no active staff, and unknown slugs', async () => {
    const f = await makeFixture(db);
    await pool.query(`UPDATE staff SET active = false WHERE business_id = $1`, [f.businessId]);
    expect((await getPublicCatalog(db, f.slug))?.staff).toEqual([]);
    expect(await getPublicCatalog(db, 'no-such-salon')).toBeNull();
  });
});

describe('resolveService', () => {
  it('finds a service by id or slug, and nothing otherwise', async () => {
    const f = await makeFixture(db);
    const c = await getPublicCatalog(db, f.slug);
    if (!c) throw new Error('no catalog');
    expect(resolveService(c, 'low-cut')?.id).toBe(f.depositServiceId);
    expect(resolveService(c, f.freeServiceId)?.slug).toBe('beard-sculpt');
    expect(resolveService(c, 'perm')).toBeNull();
  });
});
