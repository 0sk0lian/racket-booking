/**
 * Web push notification helper.
 *
 * This is a stub that logs instead of sending until VAPID keys are configured.
 * When VAPID keys are set, the actual web-push library can be wired in.
 * We do NOT import web-push here because it has native dependencies that
 * may not work on Vercel serverless.
 */

export async function sendPushNotification(
  subscription: { endpoint: string; keys?: { p256dh: string; auth: string } },
  payload: { title: string; body: string; url?: string },
) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.log('[push] VAPID not configured, skipping push:', payload.title);
    return;
  }

  // When web-push is installed and VAPID keys are configured, replace this
  // stub with:
  //
  // import webpush from 'web-push';
  // webpush.setVapidDetails(
  //   'mailto:' + (process.env.PUSH_CONTACT_EMAIL || 'noreply@racketbooking.se'),
  //   process.env.VAPID_PUBLIC_KEY,
  //   process.env.VAPID_PRIVATE_KEY,
  // );
  // await webpush.sendNotification(subscription, JSON.stringify(payload));

  console.log('[push] Would send notification to', subscription.endpoint, payload);
}
