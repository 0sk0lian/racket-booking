'use client';
/**
 * Global error boundary — catches unhandled errors in any page/layout and
 * shows a recovery UI. Sentry captures the error automatically if configured.
 */
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f8fafc' }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>&#x26A0;&#xFE0F;</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h2>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20, lineHeight: 1.6 }}>
          An unexpected error occurred. The team has been notified.
          {error.digest && <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 6 }}>Error ID: {error.digest}</span>}
        </p>
        <button
          onClick={reset}
          style={{
            padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600,
            border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
