import Stripe from 'stripe';

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY not configured — payment operations unavailable');
  }
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

/**
 * Initiate a pre-authorization hold on the booker's card for the full booking amount.
 * If split payment: booker pays their share and authorizes hold for the rest.
 * This hold is later captured or released depending on split payment outcomes.
 *
 * Reference: docs/ARCHITECTURE.md → "Orchestrating Split Payments via Stripe Connect"
 */
export async function initiatePaymentHold(
  userId: string,
  totalAmount: number,
  bookingId: string
): Promise<Stripe.PaymentIntent> {
  const paymentIntent = await getStripe().paymentIntents.create({
    amount: Math.round(totalAmount * 100), // Stripe uses smallest unit (öre)
    currency: 'sek',
    capture_method: 'manual', // Pre-authorization hold; capture later
    metadata: {
      bookingId,
      userId,
      type: 'booking_hold',
    },
  });

  return paymentIntent;
}

/**
 * Create individual Stripe Checkout sessions for split payment participants.
 * Each participant receives a link to pay their share.
 */
export async function createSplitPaymentSessions(
  bookingId: string,
  participantIds: string[]
): Promise<void> {
  // In production: look up each participant's split amount from DB,
  // then create Checkout sessions or Payment Intents with deep links.
  // For now this is a placeholder that logs intent.
  for (const participantId of participantIds) {
    console.log(`[payment] Would create split payment session for user ${participantId} on booking ${bookingId}`);
  }
}

/**
 * Distribute funds from the platform's central account to a club's Stripe Express account.
 * Deducts platform convenience fee + 25% VAT on the fee before transfer.
 *
 * Reference: docs/ARCHITECTURE.md → "Payment Infrastructure and Distributed Transactions"
 */
export async function distributeFundsToClub(
  chargeId: string,
  clubStripeAccountId: string,
  totalAmount: number,
  platformFee: number
): Promise<Stripe.Transfer> {
  const transferAmount = totalAmount - platformFee;

  const transfer = await getStripe().transfers.create({
    amount: Math.round(transferAmount * 100), // öre
    currency: 'sek',
    destination: clubStripeAccountId,
    source_transaction: chargeId,
    description: `Court booking payout`,
  });

  return transfer;
}

/**
 * Cancel/release a payment hold (e.g., when booking is cancelled).
 */
export async function cancelPaymentHold(paymentIntentId: string): Promise<void> {
  await getStripe().paymentIntents.cancel(paymentIntentId);
}

/**
 * Capture a previously authorized payment hold.
 * Used when split payment deadline passes and booker covers remaining amount.
 */
export async function capturePaymentHold(
  paymentIntentId: string,
  amountToCapture?: number
): Promise<Stripe.PaymentIntent> {
  return await getStripe().paymentIntents.capture(paymentIntentId, {
    amount_to_capture: amountToCapture ? Math.round(amountToCapture * 100) : undefined,
  });
}
