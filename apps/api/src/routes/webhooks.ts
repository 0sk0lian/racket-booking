import { Router, Request, Response } from 'express';
import express from 'express';
import Stripe from 'stripe';
import { queryOne } from '../db.js';

export const webhookRoutes = Router();

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

// Stripe webhooks need raw body for signature verification
webhookRoutes.use(express.raw({ type: 'application/json' }));

// POST /api/webhooks/stripe — handle Stripe webhook events
webhookRoutes.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    res.status(500).send('Webhook secret not configured');
    return;
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const bookingId = paymentIntent.metadata?.bookingId;
      const userId = paymentIntent.metadata?.userId;

      if (bookingId && userId) {
        // Mark split payment as paid
        await queryOne(
          `UPDATE split_payments SET payment_status = 'paid', paid_at = NOW(),
                  stripe_payment_intent_id = $3, updated_at = NOW()
           WHERE booking_id = $1 AND user_id = $2 AND payment_status = 'pending'`,
          [bookingId, userId, paymentIntent.id]
        );

        // Check if all split payments are now paid
        const pending = await queryOne<{ count: string }>(
          `SELECT COUNT(*) as count FROM split_payments
           WHERE booking_id = $1 AND payment_status = 'pending'`,
          [bookingId]
        );

        if (pending && Number(pending.count) === 0) {
          // All paid — confirm the booking
          await queryOne(
            `UPDATE bookings SET status = 'confirmed', updated_at = NOW()
             WHERE id = $1 AND status = 'pending'`,
            [bookingId]
          );
          console.log(`Booking ${bookingId} fully paid and confirmed`);
        }
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const bookingId = paymentIntent.metadata?.bookingId;
      const userId = paymentIntent.metadata?.userId;

      if (bookingId && userId) {
        await queryOne(
          `UPDATE split_payments SET payment_status = 'failed', updated_at = NOW()
           WHERE booking_id = $1 AND user_id = $2`,
          [bookingId, userId]
        );
      }
      break;
    }

    default:
      console.log(`Unhandled webhook event type: ${event.type}`);
  }

  res.json({ received: true });
});

// POST /api/webhooks/swish — handle Swish payment callbacks
webhookRoutes.post('/swish', async (req: Request, res: Response) => {
  const { paymentReference, status, payerAlias } = req.body;

  if (status === 'PAID') {
    // Look up the booking/split_payment by Swish reference
    // Implementation depends on how we store the Swish payment reference
    console.log(`Swish payment confirmed: ${paymentReference} from ${payerAlias}`);
  }

  res.json({ received: true });
});
