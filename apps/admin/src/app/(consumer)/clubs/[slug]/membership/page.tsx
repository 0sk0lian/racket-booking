'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

interface FormField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'date';
  required?: boolean;
  options?: string[];
}

interface MembershipType {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  form_fields: FormField[];
}

interface UserProfile {
  email?: string | null;
  full_name?: string | null;
  phone_number?: string | null;
  birth_date?: string | null;
}

function splitName(fullName: string | null | undefined) {
  const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? '',
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
  };
}

function getInitialValue(field: FormField, profile: UserProfile) {
  const key = field.key.toLowerCase();
  const { firstName, lastName } = splitName(profile.full_name);

  if (key.includes('email') || key.includes('epost')) return profile.email ?? '';
  if (key.includes('phone') || key.includes('telefon')) return profile.phone_number ?? '';
  if (key.includes('first') || key.includes('fornamn') || key.includes('förnamn')) return firstName;
  if (key.includes('last') || key.includes('efternamn')) return lastName;
  if (key.includes('full') || key.includes('namn') || key === 'name') return profile.full_name ?? '';
  if (field.type === 'date' && (key.includes('birth') || key.includes('fodel') || key.includes('födel'))) {
    return profile.birth_date ?? '';
  }
  if (field.type === 'checkbox') return false;
  return '';
}

export default function ClubMembershipPage() {
  const { slug } = useParams<{ slug: string }>();

  const [status, setStatus] = useState<string>('loading');
  const [types, setTypes] = useState<MembershipType[]>([]);
  const [selectedType, setSelectedType] = useState('');
  const [formValues, setFormValues] = useState<Record<string, string | boolean>>({});
  const [message, setMessage] = useState('');
  const [profile, setProfile] = useState<UserProfile>({});
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/users/me')
      .then(async (response) => {
        if (!response.ok) return null;
        const body = await response.json();
        return body?.data ?? null;
      })
      .then((data) => {
        if (!data) return;
        setProfile({
          email: data.email ?? '',
          full_name: data.full_name ?? '',
          phone_number: data.phone_number ?? '',
          birth_date: data.birth_date ?? '',
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`/api/clubs/${slug}/membership`).then((r) => r.json()),
      fetch(`/api/membership-types?clubId=${slug}`).then((r) => r.json()),
    ]).then(([memberRes, typesRes]) => {
      setStatus(memberRes.data?.status ?? 'none');
      const loaded = typesRes.data ?? [];
      setTypes(loaded);
      if (loaded.length > 0) setSelectedType(loaded[0].name);
    });
  }, [slug]);

  const activeType = useMemo(
    () => types.find((type) => type.name === selectedType) ?? null,
    [selectedType, types],
  );

  useEffect(() => {
    if (!activeType) return;
    setFormValues((current) => {
      const next = { ...current };
      for (const field of activeType.form_fields ?? []) {
        if (next[field.key] === undefined) {
          next[field.key] = getInitialValue(field, profile);
        }
      }
      return next;
    });
  }, [activeType, profile]);

  const updateValue = (key: string, value: string | boolean) => {
    setFormValues((current) => ({ ...current, [key]: value }));
  };

  const validate = () => {
    if (!selectedType) return 'Välj en medlemskapstyp';
    for (const field of activeType?.form_fields ?? []) {
      const value = formValues[field.key];
      if (field.required && (value === undefined || value === '' || value === false)) {
        return `${field.label} krävs`;
      }
    }
    return null;
  };

  const submit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setApplying(true);

    const response = await fetch(`/api/clubs/${slug}/membership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        membershipType: selectedType,
        formAnswers: formValues,
        message,
      }),
    }).then((r) => r.json());

    setApplying(false);
    if (response.success) {
      setStatus('pending');
      return;
    }

    setError(response.error ?? 'Något gick fel');
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>
      <Link href={`/clubs/${slug}`} style={{ color: '#6366f1', textDecoration: 'none', fontSize: 13 }}>Tillbaka</Link>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginTop: 8, marginBottom: 20 }}>Bli medlem</h1>

      {status === 'loading' && <p style={{ color: '#94a3b8' }}>Laddar...</p>}

      {status === 'none' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 28 }}>
          {error && (
            <div style={{ padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {types.length > 0 && (
              <div>
                <label style={labelStyle}>Medlemskapstyp *</label>
                <select value={selectedType} onChange={(event) => setSelectedType(event.target.value)} style={inputStyle}>
                  {types.map((type) => (
                    <option key={type.id} value={type.name}>
                      {type.name}{type.price > 0 ? ` - ${type.price} ${type.currency}` : ' - Gratis'}
                    </option>
                  ))}
                </select>
                {activeType?.description && (
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 6, lineHeight: 1.6 }}>{activeType.description}</div>
                )}
              </div>
            )}

            {(activeType?.form_fields ?? []).map((field) => (
              <div key={field.key}>
                <label style={labelStyle}>
                  {field.label}{field.required ? ' *' : ''}
                </label>
                {field.type === 'text' && (
                  <input
                    type="text"
                    value={String(formValues[field.key] ?? '')}
                    onChange={(event) => updateValue(field.key, event.target.value)}
                    style={inputStyle}
                  />
                )}
                {field.type === 'number' && (
                  <input
                    type="number"
                    value={String(formValues[field.key] ?? '')}
                    onChange={(event) => updateValue(field.key, event.target.value)}
                    style={inputStyle}
                  />
                )}
                {field.type === 'date' && (
                  <input
                    type="date"
                    value={String(formValues[field.key] ?? '')}
                    onChange={(event) => updateValue(field.key, event.target.value)}
                    style={inputStyle}
                  />
                )}
                {field.type === 'select' && (
                  <select
                    value={String(formValues[field.key] ?? '')}
                    onChange={(event) => updateValue(field.key, event.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Välj...</option>
                    {(field.options ?? []).map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                )}
                {field.type === 'checkbox' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#334155' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(formValues[field.key])}
                      onChange={(event) => updateValue(field.key, event.target.checked)}
                    />
                    Ja
                  </label>
                )}
              </div>
            ))}

            <div>
              <label style={labelStyle}>Meddelande till klubben</label>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                placeholder="Frivilligt meddelande..."
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

      {status === 'pending' && (
        <StatusCard
          icon="&#9993;"
          title="Tack för din ansökan"
          body="Klubben granskar din medlemsansökan och återkommer när den är behandlad."
          accent="#64748b"
          border="#e2e8f0"
        />
      )}

      {status === 'approved' && (
        <StatusCard
          icon="&#128221;"
          title="Ansökan godkänd"
          body="Din ansökan är godkänd och en faktura har skickats. Medlemskapet aktiveras när betalningen registreras."
          accent="#b45309"
          border="#fde68a"
        />
      )}

      {status === 'active' && (
        <StatusCard
          icon="&#9989;"
          title="Du är medlem!"
          body="Ditt medlemskap är aktivt. Välkommen till klubben."
          accent="#059669"
          border="#a7f3d0"
        />
      )}

      {status === 'rejected' && (
        <StatusCard
          icon="&#10060;"
          title="Ansökan avslagen"
          body="Din ansökan har avslagits. Kontakta klubben för mer information."
          accent="#dc2626"
          border="#fecaca"
        />
      )}

      {status === 'suspended' && (
        <StatusCard
          icon="&#9888;"
          title="Medlemskap pausat"
          body="Kontakta klubben för mer information om ditt medlemskap."
          accent="#b45309"
          border="#fde68a"
        />
      )}
    </div>
  );
}

function StatusCard({ icon, title, body, accent, border }: { icon: string; title: string; body: string; accent: string; border: string }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${border}`, borderRadius: 16, padding: 32, textAlign: 'center' }}>
      <p style={{ fontSize: 42, marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: icon }} />
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: accent }}>{title}</h2>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>{body}</p>
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
