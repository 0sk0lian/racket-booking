'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );

  const submit = async () => {
    setError('');
    if (password.length < 6) {
      return setError('Password must be at least 6 characters');
    }
    if (password !== confirm) {
      return setError('Passwords do not match');
    }

    setBusy(true);

    // Update password
    const { error: pwErr } = await supabase.auth.updateUser({ password });
    if (pwErr) {
      setBusy(false);
      return setError(pwErr.message);
    }

    // Clear the must_change_password flag
    await supabase.auth.updateUser({
      data: { must_change_password: false },
    });

    setBusy(false);
    router.push('/dashboard');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg, #f8fafc)',
      fontFamily: 'inherit',
    }}>
      <div style={{
        width: 400,
        background: 'var(--bg-card, #fff)',
        border: '1px solid var(--border, #e2e8f0)',
        borderRadius: 16,
        padding: 32,
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Change Your Password</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted, #64748b)', marginBottom: 24 }}>
          Your account was created with a temporary password. Please set a new password to continue.
        </p>

        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)', display: 'block', marginBottom: 4 }}>
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--border, #e2e8f0)',
                fontSize: 14,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)', display: 'block', marginBottom: 4 }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--border, #e2e8f0)',
                fontSize: 14,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            onClick={submit}
            disabled={busy || !password || !confirm}
            className="btn btn-primary"
            style={{ marginTop: 8, padding: '12px 0', fontSize: 14, width: '100%' }}
          >
            {busy ? 'Saving...' : 'Set New Password'}
          </button>
        </div>
      </div>
    </div>
  );
}
