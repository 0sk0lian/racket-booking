'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

interface MembershipType {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
}

export default function ClubMembershipPage() {
  const { slug } = useParams<{ slug: string }>();

  const [status, setStatus] = useState<string>('loading');
  const [types, setTypes] = useState<MembershipType[]>([]);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [personalNumber, setPersonalNumber] = useState('');
  const [sport, setSport] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [message, setMessage] = useState('');

  // Load current user email + membership status + types
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setEmail(data.user.email ?? '');
        const meta = data.user.user_metadata ?? {};
        const fullName = (meta.full_name as string) ?? '';
        const parts = fullName.split(' ');
        if (parts.length >= 2) {
          setFirstName(parts[0]);
          setLastName(parts.slice(1).join(' '));
        } else if (parts.length === 1) {
          setFirstName(parts[0]);
        }
      }
    });

    Promise.all([
      fetch(`/api/clubs/${slug}/membership`).then(r => r.json()),
      fetch(`/api/membership-types?clubId=${slug}`).then(r => r.json()),
    ]).then(([memberRes, typesRes]) => {
      setStatus(memberRes.data?.status ?? 'none');
      const loaded = typesRes.data ?? [];
      setTypes(loaded);
      if (loaded.length > 0) setSelectedType(loaded[0].name);
    });
  }, [slug]);

  const validate = (): string | null => {
    if (!firstName.trim()) return 'Förnamn krävs';
    if (!lastName.trim()) return 'Efternamn krävs';
    if (!phone.trim()) return 'Telefonnummer krävs';
    if (!personalNumber.trim()) return 'Personnummer krävs';
    if (!sport) return 'Välj sport';
    if (types.length > 0 && !selectedType) return 'Välj medlemskapstyp';
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setApplying(true);

    const res = await fetch(`/api/clubs/${slug}/membership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        membershipType: selectedType || 'standard',
        formAnswers: {
          fornamn: firstName.trim(),
          efternamn: lastName.trim(),
          epost: email,
          telefon: phone.trim(),
          personnummer: personalNumber.trim(),
          sport,
          meddelande: message.trim() || undefined,
        },
      }),
    }).then(r => r.json());

    setApplying(false);
    if (res.success) {
      setStatus('pending');
    } else {
      setError(res.error ?? 'Något gick fel');
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px' }}>
      <Link href={`/clubs/${slug}`} style={{ color: '#6366f1', textDecoration: 'none', fontSize: 13 }}>Tillbaka</Link>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginTop: 8, marginBottom: 20 }}>Bli medlem</h1>

      {status === 'loading' && <p style={{ color: '#94a3b8' }}>Laddar...</p>}

      {/* === FORMULÄR === */}
      {status === 'none' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 28 }}>
          {error && (
            <div style={{ padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Förnamn *" value={firstName} onChange={setFirstName} />
              <Field label="Efternamn *" value={lastName} onChange={setLastName} />
            </div>

            <Field label="E-post" value={email} onChange={() => {}} disabled />

            <Field label="Telefonnummer *" value={phone} onChange={setPhone} placeholder="0701234567" />

            <Field label="Personnummer *" value={personalNumber} onChange={setPersonalNumber} placeholder="ÅÅÅÅMMDDXXXX" />

            <div>
              <label style={labelStyle}>Sport *</label>
              <select value={sport} onChange={e => setSport(e.target.value)} style={inputStyle}>
                <option value="">Välj sport...</option>
                <option value="tennis">Tennis</option>
                <option value="padel">Padel</option>
                <option value="both">Båda</option>
              </select>
            </div>

            {types.length > 0 && (
              <div>
                <label style={labelStyle}>Medlemskapstyp *</label>
                <select value={selectedType} onChange={e => setSelectedType(e.target.value)} style={inputStyle}>
                  {types.map(t => (
                    <option key={t.id} value={t.name}>
                      {t.name}{t.price > 0 ? ` — ${t.price} ${t.currency}` : ' — Gratis'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label style={labelStyle}>Meddelande till klubben</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Frivilligt meddelande..."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <button onClick={submit} disabled={applying} style={{
              width: '100%', padding: '14px 0', borderRadius: 12, fontSize: 15, fontWeight: 700,
              color: '#fff', background: '#6366f1', border: 'none',
              cursor: applying ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}>
              {applying ? 'Skickar...' : 'Skicka ansökan'}
            </button>
          </div>
        </div>
      )}

      {/* === PENDING === */}
      {status === 'pending' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 32, textAlign: 'center' }}>
          <p style={{ fontSize: 42, marginBottom: 12 }}>&#9993;</p>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Tack för din ansökan</h2>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
            Klubben granskar din medlemsansökan och återkommer.
          </p>
        </div>
      )}

      {/* === APPROVED / ACTIVE === */}
      {(status === 'approved' || status === 'active') && (
        <div style={{ background: '#fff', border: '1px solid #a7f3d0', borderRadius: 16, padding: 32, textAlign: 'center' }}>
          <p style={{ fontSize: 42, marginBottom: 12 }}>&#9989;</p>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#059669' }}>Du är medlem!</h2>
          <p style={{ fontSize: 14, color: '#64748b' }}>Välkommen till klubben.</p>
        </div>
      )}

      {/* === REJECTED === */}
      {status === 'rejected' && (
        <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 16, padding: 32, textAlign: 'center' }}>
          <p style={{ fontSize: 42, marginBottom: 12 }}>&#10060;</p>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#dc2626' }}>Ansökan avslagen</h2>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
            Din ansökan har avslagits. Kontakta klubben för mer information.
          </p>
        </div>
      )}

      {/* === SUSPENDED === */}
      {status === 'suspended' && (
        <div style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 16, padding: 32, textAlign: 'center' }}>
          <p style={{ fontSize: 42, marginBottom: 12 }}>&#9888;</p>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#b45309' }}>Medlemskap pausat</h2>
          <p style={{ fontSize: 14, color: '#64748b' }}>Kontakta klubben för mer information.</p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{ ...inputStyle, opacity: disabled ? 0.6 : 1 }}
      />
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0',
  fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
};
