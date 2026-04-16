'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function ClubMembershipPage() {
  const { slug } = useParams<{ slug: string }>();
  const [status, setStatus] = useState<string>('loading');
  const [applying, setApplying] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetch(`/api/clubs/${slug}/membership`).then(r => r.json()).then(r => setStatus(r.data?.status ?? 'none'));
  }, [slug]);

  const apply = async () => {
    setApplying(true);
    const res = await fetch(`/api/clubs/${slug}/membership`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.json());
    if (res.success) { setStatus('pending'); setToast('Ansökan skickad!'); }
    else { setToast(res.error ?? 'Misslyckades'); }
    setApplying(false);
    setTimeout(() => setToast(''), 4000);
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px' }}>
      <Link href={`/clubs/${slug}`} style={{ color: '#6366f1', textDecoration: 'none', fontSize: 13, marginBottom: 16, display: 'inline-block' }}>← Tillbaka</Link>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Medlemskap</h1>

      {toast && <div style={{ padding: '10px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, color: '#059669', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{toast}</div>}

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 28 }}>
        {status === 'loading' && <p style={{ color: '#94a3b8' }}>Laddar...</p>}

        {status === 'none' && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Bli medlem</h2>
            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 20 }}>
              Som medlem får du tillgång till:
            </p>
            <ul style={{ fontSize: 14, color: '#475569', lineHeight: 2, paddingLeft: 20, marginBottom: 24 }}>
              <li>Medlemspriser på banbokning</li>
              <li>Medlemsevent och träningspass</li>
              <li>Matchning med andra medlemmar</li>
              <li>Nyheter och uppdateringar från klubben</li>
            </ul>
            <button onClick={apply} disabled={applying} style={{ padding: '12px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', cursor: applying ? 'wait' : 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}>
              {applying ? 'Skickar...' : 'Ansök om medlemskap'}
            </button>
          </>
        )}

        {status === 'pending' && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <p style={{ fontSize: 42, marginBottom: 12 }}>⏳</p>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Ansökan inskickad</h2>
            <p style={{ fontSize: 14, color: '#64748b' }}>Din ansökan har skickats till klubben. Du får besked så snart den har godkänts.</p>
          </div>
        )}

        {status === 'active' && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <p style={{ fontSize: 42, marginBottom: 12 }}>✅</p>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#059669' }}>Du är medlem!</h2>
            <p style={{ fontSize: 14, color: '#64748b' }}>Du har full tillgång till klubbens träningar, event och matcher.</p>
          </div>
        )}

        {status === 'suspended' && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <p style={{ fontSize: 42, marginBottom: 12 }}>⚠️</p>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#b45309' }}>Medlemskap pausat</h2>
            <p style={{ fontSize: 14, color: '#64748b' }}>Kontakta klubben för mer information.</p>
          </div>
        )}
      </div>
    </div>
  );
}
