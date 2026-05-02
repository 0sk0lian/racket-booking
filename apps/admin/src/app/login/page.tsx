'use client';
/**
 * Login + signup page.
 *
 * Login uses Supabase Auth UI.
 * Signup uses a custom form to collect: email, password, full name, birthdate.
 * The signup trigger (migration 049) captures birth_date from user_metadata.
 */
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>Laddar...</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [view, setView] = useState<'sign_in' | 'sign_up' | 'forgot'>('sign_in');

  // Signup form state
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupBirthDate, setSignupBirthDate] = useState('');
  const [signupError, setSignupError] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const redirectAfterLogin = useCallback(async () => {
    if (next) {
      router.replace(next);
      return;
    }

    try {
      const response = await fetch('/api/users/me');
      const body = await response.json();
      const role = body?.data?.role;
      if (role === 'trainer') {
        router.replace('/my-sessions');
        return;
      }
      if (role === 'admin' || role === 'superadmin') {
        router.replace('/dashboard');
        return;
      }
    } catch {
      // Fall back to player home below.
    }

    router.replace('/');
  }, [next, router]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void redirectAfterLogin();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') void redirectAfterLogin();
    });
    return () => sub.subscription.unsubscribe();
  }, [redirectAfterLogin, supabase]);

  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next ?? '/')}`
      : undefined;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError('');

    if (!signupName.trim()) return setSignupError('Namn krävs');
    if (!signupBirthDate) return setSignupError('Födelsedatum krävs');
    if (signupPassword.length < 6) return setSignupError('Lösenordet måste vara minst 6 tecken');

    setSignupLoading(true);
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          full_name: signupName.trim(),
          birth_date: signupBirthDate,
        },
      },
    });
    setSignupLoading(false);

    if (error) {
      setSignupError(error.message);
    } else {
      setSignupSuccess(true);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Racket Booking</h1>
          <p style={{ fontSize: 13, color: '#64748b' }}>
            {view === 'sign_in' ? 'Logga in på ditt konto' : view === 'sign_up' ? 'Skapa ett nytt konto' : 'Återställ lösenord'}
          </p>
        </div>

        {view === 'sign_in' && (
          <>
            <Auth
              supabaseClient={supabase}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: { brand: '#6366f1', brandAccent: '#4f46e5', inputBackground: '#ffffff', inputBorder: '#e2e8f0', inputBorderHover: '#a5b4fc', inputBorderFocus: '#6366f1' },
                    radii: { borderRadiusButton: '10px', inputBorderRadius: '10px' },
                    fonts: { bodyFontFamily: 'inherit', buttonFontFamily: 'inherit', inputFontFamily: 'inherit', labelFontFamily: 'inherit' },
                  },
                },
              }}
              providers={[]}
              redirectTo={redirectTo}
              showLinks={false}
              view="sign_in"
              localization={{
                variables: {
                  sign_in: { email_label: 'E-post', password_label: 'Lösenord', button_label: 'Logga in' },
                  forgotten_password: { email_label: 'E-post', button_label: 'Skicka återställningslänk', link_text: 'Glömt lösenord?' },
                },
              }}
            />
            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
              <button onClick={() => setView('sign_up')} style={linkBtn}>Inget konto? Skapa ett</button>
              <span style={{ margin: '0 8px', color: '#cbd5e1' }}>|</span>
              <button onClick={() => setView('forgot')} style={linkBtn}>Glömt lösenord?</button>
            </div>
          </>
        )}

        {view === 'forgot' && (
          <>
            <Auth
              supabaseClient={supabase}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: { brand: '#6366f1', brandAccent: '#4f46e5', inputBackground: '#ffffff', inputBorder: '#e2e8f0' },
                    radii: { borderRadiusButton: '10px', inputBorderRadius: '10px' },
                    fonts: { bodyFontFamily: 'inherit', buttonFontFamily: 'inherit', inputFontFamily: 'inherit', labelFontFamily: 'inherit' },
                  },
                },
              }}
              providers={[]}
              showLinks={false}
              view="forgotten_password"
              localization={{
                variables: {
                  forgotten_password: { email_label: 'E-post', button_label: 'Skicka återställningslänk' },
                },
              }}
            />
            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
              <button onClick={() => setView('sign_in')} style={linkBtn}>Tillbaka till inloggning</button>
            </div>
          </>
        )}

        {view === 'sign_up' && (
          <>
            {signupSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>&#9989;</div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Konto skapat!</h2>
                <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                  Kolla din e-post för en bekräftelselänk. När du bekräftat kan du logga in.
                </p>
                <button onClick={() => { setView('sign_in'); setSignupSuccess(false); }} style={{ ...primaryBtn, marginTop: 16 }}>
                  Till inloggning
                </button>
              </div>
            ) : (
              <form onSubmit={handleSignup}>
                {signupError && (
                  <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#dc2626', fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
                    {signupError}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Namn</label>
                    <input type="text" value={signupName} onChange={e => setSignupName(e.target.value)} placeholder="Förnamn Efternamn" required style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Födelsedatum</label>
                    <input type="date" value={signupBirthDate} onChange={e => setSignupBirthDate(e.target.value)} required style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>E-post</label>
                    <input type="email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} placeholder="din@email.com" required style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Lösenord</label>
                    <input type="password" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} placeholder="Minst 6 tecken" required minLength={6} style={inputStyle} />
                  </div>

                  <button type="submit" disabled={signupLoading} style={primaryBtn}>
                    {signupLoading ? 'Skapar konto...' : 'Skapa konto'}
                  </button>
                </div>

                <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
                  <button type="button" onClick={() => setView('sign_in')} style={linkBtn}>Har du redan ett konto? Logga in</button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
};
const cardStyle: React.CSSProperties = {
  width: '100%', maxWidth: 420, padding: 36, background: '#ffffff', borderRadius: 18,
  boxShadow: '0 20px 60px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0',
  fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
  transition: 'border-color 0.2s',
};
const primaryBtn: React.CSSProperties = {
  width: '100%', padding: '12px 0', borderRadius: 10, fontSize: 14, fontWeight: 700,
  color: '#fff', background: '#6366f1', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
};
const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#6366f1', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline',
};
