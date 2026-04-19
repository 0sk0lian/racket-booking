'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface MembershipType {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  interval: string;
}

const intervalLabels: Record<string, string> = {
  month: 'månad',
  quarter: 'kvartal',
  half_year: 'halvår',
  year: 'år',
  once: 'engångs',
};

export default function ClubMembershipPage() {
  const { slug } = useParams<{ slug: string }>();
  const [status, setStatus] = useState<string>('loading');
  const [types, setTypes] = useState<MembershipType[]>([]);
  const [selectedType, setSelectedType] = useState<string>('');
  const [applying, setApplying] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    Promise.all([
      fetch(`/api/clubs/${slug}/membership`).then((r) => r.json()),
      fetch(`/api/membership-types?clubId=${slug}`).then((r) => r.json()),
    ]).then(([membershipRes, typesRes]) => {
      setStatus(membershipRes.data?.status ?? 'none');
      const loadedTypes = typesRes.data ?? [];
      setTypes(loadedTypes);
      if (loadedTypes.length > 0) setSelectedType(loadedTypes[0].name);
    });
  }, [slug]);

  const apply = async () => {
    setApplying(true);
    const res = await fetch(`/api/clubs/${slug}/membership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ membershipType: selectedType || 'standard' }),
    }).then((r) => r.json());
    if (res.success) { setStatus('pending'); setToast('Ansökan skickad!'); }
    else { setToast(res.error ?? 'Misslyckades'); }
    setApplying(false);
    setTimeout(() => setToast(''), 4000);
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px' }}>
      <Link href={`/clubs/${slug}`} style={{ color: '#6366f1', textDecoration: 'none', fontSize: 13, marginBottom: 16, display: 'inline-block' }}>Tillbaka</Link>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Medlemskap</h1>

      {toast && <div style={{ padding: '10px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, color: '#059669', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{toast}</div>}

      {status === 'loading' && <p style={{ color: '#94a3b8' }}>Laddar...</p>}

      {status === 'none' && (
        <>
          {types.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {types.map((t) => {
                const isSelected = selectedType === t.name;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedType(t.name)}
                    style={{
                      textAlign: 'left',
                      padding: '20px 24px',
                      borderRadius: 14,
                      border: isSelected ? '2px solid #6366f1' : '1px solid #e2e8f0',
                      background: isSelected ? '#eef2ff' : '#fff',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: isSelected ? '#4338ca' : '#1e293b' }}>{t.name}</div>
                        {t.description && <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{t.description}</div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: isSelected ? '#4338ca' : '#1e293b' }}>
                          {t.price > 0 ? `${t.price} ${t.currency}` : 'Gratis'}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                          {intervalLabels[t.interval] ?? t.interval}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 28, marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Bli medlem</h2>
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 0 }}>
                Som medlem får du tillgång till medlemspriser, träningspass, event och matchning.
              </p>
            </div>
          )}

          <button onClick={apply} disabled={applying} style={{ padding: '14px 32px', borderRadius: 12, fontSize: 15, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', cursor: applying ? 'wait' : 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(99,102,241,0.3)', width: '100%' }}>
            {applying ? 'Skickar...' : types.length > 0 ? `Ansök om ${selectedType}` : 'Ansök om medlemskap'}
          </button>
        </>
      )}

      {status === 'pending' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 42, marginBottom: 12 }}>&#8987;</p>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Ansökan inskickad</h2>
          <p style={{ fontSize: 14, color: '#64748b' }}>Din ansökan har skickats till klubben. Du får besked så snart den har godkänts.</p>
        </div>
      )}

      {status === 'active' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 42, marginBottom: 12 }}>&#9989;</p>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#059669' }}>Du är medlem!</h2>
          <p style={{ fontSize: 14, color: '#64748b' }}>Du har full tillgång till klubbens träningar, event och matcher.</p>
        </div>
      )}

      {status === 'suspended' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 42, marginBottom: 12 }}>&#9888;</p>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#b45309' }}>Medlemskap pausat</h2>
          <p style={{ fontSize: 14, color: '#64748b' }}>Kontakta klubben för mer information.</p>
        </div>
      )}
    </div>
  );
}
