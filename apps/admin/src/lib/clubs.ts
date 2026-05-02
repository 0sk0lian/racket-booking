import { createSupabaseAdminClient } from './supabase/server';

type ClubIdentity = {
  id: string;
  slug?: string | null;
  [key: string]: unknown;
};

function asClubIdentity(value: unknown): ClubIdentity | null {
  if (!value || typeof value !== 'object' || !('id' in value)) return null;
  return value as ClubIdentity;
}

export async function findClubByIdentifier(
  identifier: string,
  columns = 'id, slug',
  supabase = createSupabaseAdminClient(),
): Promise<ClubIdentity | null> {
  if (!identifier) return null;

  const { data: byId } = await supabase
    .from('clubs')
    .select(columns)
    .eq('id', identifier)
    .maybeSingle();

  const byIdClub = asClubIdentity(byId);
  if (byIdClub) return byIdClub;

  const { data: bySlug } = await supabase
    .from('clubs')
    .select(columns)
    .eq('slug', identifier)
    .maybeSingle();

  return asClubIdentity(bySlug);
}

export async function resolveClubId(
  identifier: string,
  supabase = createSupabaseAdminClient(),
): Promise<string | null> {
  const club = await findClubByIdentifier(identifier, 'id', supabase);
  return club?.id ?? null;
}

export function clubPublicPath(club: { id: string; slug?: string | null }) {
  return `/clubs/${club.slug || club.id}`;
}
