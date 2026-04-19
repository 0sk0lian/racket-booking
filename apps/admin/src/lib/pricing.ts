import { createSupabaseAdminClient } from './supabase/server';

interface PriceCalculation {
  basePrice: number;
  memberDiscount: number;
  groupRate: number | null;
  peakMultiplier: number;
  finalPrice: number;
  platformFee: number;
  totalPrice: number;
  breakdown: string;
}

/**
 * Calculate the price for a booking, considering:
 * - Base court rate
 * - Peak/off-peak pricing (from price_rules)
 * - Member discount (from venue_profiles)
 * - Group-specific rates (from trainer_rates on trainer)
 */
export async function calculateBookingPrice(params: {
  courtId: string;
  clubId: string;
  durationHours: number;
  startHour: number;
  dayOfWeek: number;
  userId?: string;
  bookingType?: string;
  trainerId?: string;
  groupCategory?: string; // junior, adult, senior, etc.
}): Promise<PriceCalculation> {
  const supabase = createSupabaseAdminClient();

  // 1. Base court rate
  const { data: court } = await supabase
    .from('courts')
    .select('base_hourly_rate')
    .eq('id', params.courtId)
    .single();

  const baseRate = court?.base_hourly_rate ?? 0;
  const basePrice = baseRate * params.durationHours;

  // 2. Peak/off-peak (from price_rules)
  let peakMultiplier = 1;
  const { data: priceRule } = await supabase
    .from('price_rules')
    .select('price_multiplier')
    .eq('court_id', params.courtId)
    .eq('day_of_week', params.dayOfWeek)
    .lte('start_hour', params.startHour)
    .gt('end_hour', params.startHour)
    .maybeSingle();

  if (priceRule?.price_multiplier) {
    peakMultiplier = priceRule.price_multiplier;
  }

  // 3. Member discount
  let memberDiscount = 0;
  if (params.userId) {
    const { data: venue } = await supabase
      .from('venue_profiles')
      .select('member_discount_percent')
      .eq('club_id', params.clubId)
      .maybeSingle();

    if (venue?.member_discount_percent) {
      const { data: membership } = await supabase
        .from('club_memberships')
        .select('status, expires_at')
        .eq('club_id', params.clubId)
        .eq('user_id', params.userId)
        .eq('status', 'active')
        .maybeSingle();

      if (membership) {
        const isExpired = membership.expires_at && new Date(membership.expires_at) < new Date();
        if (!isExpired) {
          memberDiscount = venue.member_discount_percent;
        }
      }
    }
  }

  // 4. Group/category rate (from trainer)
  let groupRate: number | null = null;
  if (params.trainerId && params.groupCategory) {
    const { data: trainer } = await supabase
      .from('users')
      .select('trainer_rates')
      .eq('id', params.trainerId)
      .single();

    if (trainer?.trainer_rates && typeof trainer.trainer_rates === 'object') {
      const rates = trainer.trainer_rates as Record<string, number>;
      if (rates[params.groupCategory]) {
        groupRate = rates[params.groupCategory];
      }
    }
  }

  // 5. Calculate final price
  const adjustedBase = basePrice * peakMultiplier;
  const afterDiscount = adjustedBase * (1 - memberDiscount / 100);
  const finalPrice = groupRate !== null ? groupRate * params.durationHours : afterDiscount;
  const platformFee = finalPrice * 0.05;
  const totalPrice = finalPrice + platformFee;

  // Build breakdown string
  const parts: string[] = [`Base: ${basePrice} SEK`];
  if (peakMultiplier !== 1) parts.push(`Peak: x${peakMultiplier}`);
  if (memberDiscount > 0) parts.push(`Member: -${memberDiscount}%`);
  if (groupRate !== null) parts.push(`Group rate: ${groupRate}/h`);
  parts.push(`Platform: +5%`);

  return {
    basePrice,
    memberDiscount,
    groupRate,
    peakMultiplier,
    finalPrice,
    platformFee,
    totalPrice,
    breakdown: parts.join(' | '),
  };
}
