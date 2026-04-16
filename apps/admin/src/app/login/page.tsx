'use client';
/**
 * Login + signup page using @supabase/auth-ui-react.
 *
 * The first user to sign up is auto-promoted to 'admin' by the trigger in
 * migration 030. Everyone after defaults to 'player'.
 *
 * After a successful sign-in, the redirect comes back here via
 * /auth/callback (set as the redirectTo on the Supabase auth UI). The
 * callback route exchanges the OAuth code for a session cookie, then
 * forwards to ?next= or '/'.
 */
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/';

  // Memoise the client across renders so the auth UI doesn't re-init.
  const [supabase] = useState(() => createSupabaseBrowserClient());

  // If a session already exists, jump straight to the destination.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(next);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') router.replace(next);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, router, next]);

  // Build the absolute redirect URL for OAuth / magic-link returns.
  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
      : undefined;

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>
            Racket Booking
          </h1>
          <p style={{ fontSize: 13, color: '#64748b' }}>
            Logga in eller skapa konto
          </p>
        </div>

        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#6366f1',
                  brandAccent: '#4f46e5',
                  inputBackground: '#ffffff',
                  inputBorder: '#e2e8f0',
                  inputBorderHover: '#a5b4fc',
                  inputBorderFocus: '#6366f1',
                },
                radii: {
                  borderRadiusButton: '10px',
                  inputBorderRadius: '10px',
                },
                fonts: {
                  bodyFontFamily: 'inherit',
                  buttonFontFamily: 'inherit',
                  inputFontFamily: 'inherit',
                  labelFontFamily: 'inherit',
                },
              },
            },
          }}
          providers={[]}
          redirectTo={redirectTo}
          showLinks={true}
          view="sign_in"
          localization={{
            variables: {
              sign_in: {
                email_label: 'E-post',
                password_label: 'Lösenord',
                button_label: 'Logga in',
                link_text: 'Har du redan ett konto? Logga in',
              },
              sign_up: {
                email_label: 'E-post',
                password_label: 'Lösenord (minst 6 tecken)',
                button_label: 'Skapa konto',
                link_text: 'Inget konto? Skapa ett',
                confirmation_text: 'Kolla din e-post för en bekräftelselänk',
              },
              forgotten_password: {
                email_label: 'E-post',
                button_label: 'Skicka återställningslänk',
                link_text: 'Glömt lösenord?',
              },
            },
          }}
        />
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
};

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 420,
  padding: 36,
  background: '#ffffff',
  borderRadius: 18,
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.04)',
  border: '1px solid #e2e8f0',
};
