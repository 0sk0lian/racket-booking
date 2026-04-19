'use client';
/**
 * GlobalSearch — Ctrl+K overlay. Searches users, courses, bookings.
 * Results grouped by type with click-to-navigate.
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  id: string;
  type: 'user' | 'course' | 'booking';
  name?: string;
  email?: string;
  role?: string;
  sport?: string;
  status?: string;
  booking_type?: string;
  date?: string;
  pin?: string;
  notes?: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ users: SearchResult[]; courses: SearchResult[]; bookings: SearchResult[] }>({ users: [], courses: [], bookings: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    if (!open) { setQuery(''); setResults({ users: [], courses: [], bookings: [] }); }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults({ users: [], courses: [], bookings: [] }); return; }
    setLoading(true);
    const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`).then(r => r.json());
    setResults(res.data ?? { users: [], courses: [], bookings: [] });
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  const navigate = (path: string) => { setOpen(false); router.push(path); };

  const totalResults = results.users.length + results.courses.length + results.bookings.length;

  if (!open) return null;

  return (
    <div style={overlay} onClick={() => setOpen(false)}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 16, color: 'var(--text-dim)' }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Sök spelare, kurser, bokningar..."
            style={{ flex: 1, border: 'none', background: 'none', fontSize: 15, outline: 'none', color: 'var(--text)', fontFamily: 'inherit' }}
          />
          <kbd style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: 'var(--bg-body)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 400, overflow: 'auto', padding: '8px 0' }}>
          {loading && <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>Söker...</div>}

          {!loading && query.length >= 2 && totalResults === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>Inga resultat för "{query}"</div>
          )}

          {results.users.length > 0 && (
            <Section title="Spelare">
              {results.users.map(u => (
                <ResultRow key={u.id} onClick={() => navigate(`/users/${u.id}`)}>
                  <span style={{ fontWeight: 600 }}>{u.name}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 12, marginLeft: 8 }}>{u.email}</span>
                  <RoleBadge role={u.role ?? 'player'} />
                </ResultRow>
              ))}
            </Section>
          )}

          {results.courses.length > 0 && (
            <Section title="Kurser">
              {results.courses.map(c => (
                <ResultRow key={c.id} onClick={() => navigate(`/courses/${c.id}`)}>
                  <span style={{ fontWeight: 600 }}>{c.name}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 12, marginLeft: 8, textTransform: 'capitalize' }}>{c.sport}</span>
                </ResultRow>
              ))}
            </Section>
          )}

          {results.bookings.length > 0 && (
            <Section title="Bokningar">
              {results.bookings.map(b => (
                <ResultRow key={b.id} onClick={() => navigate(`/schedule`)}>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{b.booking_type}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 12, marginLeft: 8 }}>{b.date}</span>
                  {b.pin && <span style={{ color: 'var(--text-dim)', fontSize: 11, marginLeft: 8, fontFamily: 'monospace' }}>PIN: {b.pin}</span>}
                </ResultRow>
              ))}
            </Section>
          )}

          {query.length < 2 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>Skriv minst 2 tecken för att söka</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ padding: '6px 18px', fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
      {children}
    </div>
  );
}

function ResultRow({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', width: '100%', padding: '8px 18px', border: 'none',
      background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, gap: 4,
      fontFamily: 'inherit', color: 'var(--text)', transition: 'background 0.1s', borderRadius: 0,
    }}>
      {children}
    </button>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = { admin: '#6366f1', trainer: '#10b981', player: '#94a3b8' };
  return (
    <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600, background: `${colors[role] ?? '#94a3b8'}15`, color: colors[role] ?? '#94a3b8', textTransform: 'capitalize' }}>
      {role}
    </span>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 200, paddingTop: '15vh',
};
const modal: React.CSSProperties = {
  background: 'var(--bg-card)', borderRadius: 14, width: 560, maxHeight: '60vh',
  boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: '1px solid var(--border)', overflow: 'hidden',
};
