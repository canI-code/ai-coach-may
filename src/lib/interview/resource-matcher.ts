import type { Db } from 'mongodb';
import type { Resource } from './schemas';

export type MatchResult =
  | { ok: true; resources: Resource[] }
  | { ok: false; error: { kind: 'query_failed' } };

const MAX_RESOURCES = 5;

/**
 * Keep only resources sharing a weakness tag, order institution-matched ahead
 * of global resources (when an institution code is supplied), cap at 5.
 */
export function rankResources(
  resources: Resource[],
  weaknessTags: string[],
  institutionCode?: string,
): Resource[] {
  const wanted = new Set(weaknessTags);
  const relevant = resources.filter((r) => r.tags.some((t) => wanted.has(t)));
  const ordered = institutionCode
    ? [...relevant].sort(
        (a, b) =>
          Number(b.institutionCode === institutionCode) -
          Number(a.institutionCode === institutionCode),
      )
    : relevant;
  return ordered.slice(0, MAX_RESOURCES);
}

export async function matchResources(
  db: Db,
  weaknessTags: string[],
  institutionCode?: string,
): Promise<MatchResult> {
  if (weaknessTags.length === 0) return { ok: true, resources: [] };
  try {
    const docs = await db
      .collection('resources')
      .find({ tags: { $in: weaknessTags } })
      .toArray();
    const resources: Resource[] = docs.map((d) => ({
      id: String(d._id ?? d.id),
      title: d.title ?? '',
      url: d.url ?? '',
      tags: Array.isArray(d.tags) ? d.tags : [],
      institutionCode: d.institutionCode,
    }));
    return { ok: true, resources: rankResources(resources, weaknessTags, institutionCode) };
  } catch {
    return { ok: false, error: { kind: 'query_failed' } };
  }
}
