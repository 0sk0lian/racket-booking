'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { useEffect, useState } from 'react';

export default function ConsumerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<{ email: string; full_name?: string } | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          email: data.user.email ?? '',
          full_name: data.user.user_metadata?.full_name,
        });
      }
    });
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation */}
      <nav style={navStyle}>
        <div style={navInner}>
          <Link href="/" style={logoStyle}>
            <span style={{ fontSize: 20, fontWeight: 800, background: 'linear-gradient(135deg, #6366f1, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Racket Booking
            </span>
          </Link>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <NavLink href="/clubs" active={pathname.startsWith('/clubs')}>Anläggningar</NavLink>
            {user && (
              <>
                <NavLink href="/my" active={pathname.startsWith('/my')}>Mitt konto</NavLink>
                <NavLink href="/my/bookings" active={pathname === '/my/bookings'}>Bokningar</NavLink>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {user ? (
              <>
                <span style={{ fontSize: 13, color: '#64748b' }}>{user.full_name ?? user.email}</span>
                <Link href="/dashboard" style={btnOutline}>Admin</Link>
                <form action="/auth/signout" method="POST">
                  <button type="submit" style={btnOutline}>Logga ut</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" style={btnOutline}>Logga in</Link>
                <Link href="/login" style={btnPrimary}>Skapa konto</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main style={{ flex: 1 }}>{children}</main>

      {/* Footer */}
      <footer style={footerStyle}>
        <div style={footerInner}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Racket Booking</div>
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
              Sveriges bokningsplattform för<br />padel, tennis och squash.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 40 }}>
            <div>
              <div style={footerHeader}>Plattform</div>
              <FooterLink href="/clubs">Anläggningar</FooterLink>
              <FooterLink href="/login">Logga in</FooterLink>
            </div>
            <div>
              <div style={footerHeader}>Hjälp</div>
              <FooterLink href="#">Kontakt</FooterLink>
              <FooterLink href="#">Integritetspolicy</FooterLink>
              <FooterLink href="#">Villkor</FooterLink>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 24, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
          © {new Date().getFullYear()} Racket Booking. Alla rättigheter förbehållna.
        </div>
      </footer>
    </div>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} style={{
      padding: '8px 14px', borderRadius: 8, fontSize: 14, fontWeight: 500,
      color: active ? '#6366f1' : '#475569',
      background: active ? '#eef2ff' : 'transparent',
      textDecoration: 'none', transition: 'all 0.15s',
    }}>
      {children}
    </Link>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ display: 'block', fontSize: 13, color: '#64748b', textDecoration: 'none', padding: '3px 0' }}>
      {children}
    </Link>
  );
}

const navStyle: React.CSSProperties = {
  background: '#ffffff', borderBottom: '1px solid #e2e8f0',
  position: 'sticky', top: 0, zIndex: 50,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};
const navInner: React.CSSProperties = {
  maxWidth: 1200, margin: '0 auto', padding: '0 24px',
  height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const logoStyle: React.CSSProperties = { textDecoration: 'none' };
const btnOutline: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  color: '#475569', background: 'transparent', border: '1px solid #e2e8f0',
  textDecoration: 'none', cursor: 'pointer', fontFamily: 'inherit',
};
const btnPrimary: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  color: '#fff', background: '#6366f1', border: 'none',
  textDecoration: 'none', cursor: 'pointer',
};
const footerStyle: React.CSSProperties = {
  background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '40px 24px 24px',
};
const footerInner: React.CSSProperties = {
  maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
};
const footerHeader: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
};
