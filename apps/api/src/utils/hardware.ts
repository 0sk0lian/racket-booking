import crypto from 'crypto';

/**
 * Generate a cryptographically secure PIN for IoT door access.
 * Returns a 6-digit numeric string.
 */
export function generateSecurePin(): string {
  const pin = crypto.randomInt(100000, 999999);
  return pin.toString();
}

/**
 * Calculate VAT breakdown for a booking based on club entity status.
 * Court rental: 6% for commercial, 0% for non-profit
 * Platform fee: always 25%
 */
export function calculateVatBreakdown(
  courtRentalAmount: number,
  platformFeeAmount: number,
  isNonProfit: boolean
) {
  const courtRentalVatRate = isNonProfit ? 0 : 0.06;
  const platformFeeVatRate = 0.25;

  const courtRentalVat = courtRentalAmount * courtRentalVatRate;
  const platformFeeVat = platformFeeAmount * platformFeeVatRate;

  return {
    courtRentalAmount,
    courtRentalVatRate,
    courtRentalVat,
    platformFeeAmount,
    platformFeeVatRate,
    platformFeeVat,
    totalAmount: courtRentalAmount + platformFeeAmount,
    totalVat: courtRentalVat + platformFeeVat,
  };
}
