/**
 * Sentry client-side config — captures JS errors in the browser.
 * Only initializes if NEXT_PUBLIC_SENTRY_DSN is set (no-op in local dev by default).
 */
import * as Sentry from '@sentry/nextjs';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,       // 10% of transactions
    replaysSessionSampleRate: 0,  // No session replay (privacy-conscious default)
    replaysOnErrorSampleRate: 0.5,
    environment: process.env.NODE_ENV,
  });
}
