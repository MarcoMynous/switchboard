import { businesses, services, staff, staffServices } from '@switchboard/db/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Executor } from './context.ts';

// Public read model for /b/:slug and the agent: what a customer may see. No owner/Kora internals.

export interface PublicCatalog {
  business: {
    id: string;
    name: string;
    slug: string;
    location: string | null;
    phone: string | null;
    timezone: string;
    advanceDays: number;
    allowSameDay: boolean;
    cancellationPolicy: string | null;
  };
  services: {
    id: string;
    /** URL-friendly name, e.g. 'low-cut', so links and scripts can name a service. */
    slug: string;
    name: string;
    description: string | null;
    durationMin: number;
    priceKobo: number;
    depositType: 'fixed' | 'percent' | 'none' | 'full';
    depositValue: number;
  }[];
  staff: { id: string; name: string; roleTitle: string; serviceIds: string[] }[];
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-');
}

/** Everything the public booking page needs for one business, or null if the slug is unknown. */
export async function getPublicCatalog(db: Executor, slug: string): Promise<PublicCatalog | null> {
  const [biz] = await db.select().from(businesses).where(eq(businesses.slug, slug));
  if (!biz) return null;

  const svcRows = await db
    .select()
    .from(services)
    .where(eq(services.businessId, biz.id))
    .orderBy(asc(services.priceKobo), asc(services.name));
  const staffRows = await db
    .select()
    .from(staff)
    .where(and(eq(staff.businessId, biz.id), eq(staff.active, true)))
    .orderBy(asc(staff.name));
  const links =
    staffRows.length === 0
      ? []
      : await db
          .select()
          .from(staffServices)
          .where(
            inArray(
              staffServices.staffId,
              staffRows.map((s) => s.id),
            ),
          );

  return {
    business: {
      id: biz.id,
      name: biz.name,
      slug: biz.slug,
      location: biz.location,
      phone: biz.phone,
      timezone: biz.timezone,
      advanceDays: biz.advanceDays,
      allowSameDay: biz.allowSameDay,
      cancellationPolicy: biz.cancellationPolicy,
    },
    services: svcRows.map((s) => ({
      id: s.id,
      slug: slugify(s.name),
      name: s.name,
      description: s.description,
      durationMin: s.durationMin,
      priceKobo: s.priceKobo,
      depositType: s.depositType,
      depositValue: s.depositValue,
    })),
    staff: staffRows.map((s) => ({
      id: s.id,
      name: s.name,
      roleTitle: s.roleTitle,
      serviceIds: links.filter((l) => l.staffId === s.id).map((l) => l.serviceId),
    })),
  };
}

/** Finds a catalog service by id or by slug ('low-cut'). */
export function resolveService(catalog: PublicCatalog, ref: string) {
  return catalog.services.find((s) => s.id === ref || s.slug === ref) ?? null;
}
