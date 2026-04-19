'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function FormSubmitPage() {
  const { slug, formId } = useParams<{ slug: string; formId: string }>();
  const router = useRouter();
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch(`/api/registration-forms/${formId}`)
      .then(r => r.json())
      .then(r => { setForm(r.data); setLoading(false); });
  }, [formId]);

  const updateAnswer = (key: string, value: string | boolean) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    // Validate required fields
    for (const field of (form?.fields ?? [])) {
      if (field.required && (answers[field.key] === undefined || answers[field.key] === '' || answers[field.key] === false)) {
        setError(`"${field.label}" är obligatoriskt`);
        return;
      }
    }
    setError('');
    setSubmitting(true);

    const res = await fetch(`/api/registration-forms/${formId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    }).then(r => r.json()).catch(() => ({ success: false, error: 'Network error' }));

    setSubmitting(false);

    if (res.success) {
      setSuccess(true);
    } else if (res.error?.includes('Authentication') || res.error?.includes('401')) {
      router.push(`/login?next=/clubs/${slug}/forms/${formId}`);
    } else {
      setError(res.error ?? 'Något gick fel');
    }
  };

  if (loading) return <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px' }}><p style={{ color: '#94a3b8' }}>Laddar...</p></div>;
  if (!form) return <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px' }}><p>Formuläret hittades inte.</p></div>;

  const fields: Array<{ key: string; label: string; type: string; required: boolean; options?: string[] }> = form.fields ?? [];

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px' }}>
      <Link href={`/clubs/${slug}/forms`} style={{ color: '#6366f1', textDecoration: 'none', fontSize: 13 }}>Tillbaka till anmälningar</Link>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginTop: 8, marginBottom: 4 }}>{form.title}</h1>
      {form.description && <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20, lineHeight: 1.6 }}>{form.description}</p>}
      {form.season && <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20 }}>Säsong: {form.season}</div>}

      {success ? (
        <div style={{ background: '#fff', border: '1px solid #a7f3d0', borderRadius: 16, padding: 32, textAlign: 'center' }}>
          <p style={{ fontSize: 36, marginBottom: 12 }}>✅</p>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#059669', marginBottom: 8 }}>Anmälan skickad!</h2>
          <p style={{ fontSize: 14, color: '#64748b' }}>Du är nu anmäld. Klubben återkommer med mer information.</p>
          <Link href={`/clubs/${slug}`} style={{ display: 'inline-block', marginTop: 16, color: '#6366f1', fontWeight: 600 }}>Tillbaka till klubben</Link>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 28 }}>
          {error && (
            <div style={{ padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{error}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {fields.map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                  {f.label}{f.required && <span style={{ color: '#dc2626' }}> *</span>}
                </label>
                {f.type === 'text' && <input type="text" value={(answers[f.key] as string) ?? ''} onChange={e => updateAnswer(f.key, e.target.value)} style={formInput} />}
                {f.type === 'number' && <input type="number" value={(answers[f.key] as string) ?? ''} onChange={e => updateAnswer(f.key, e.target.value)} style={formInput} />}
                {f.type === 'select' && (
                  <select value={(answers[f.key] as string) ?? ''} onChange={e => updateAnswer(f.key, e.target.value)} style={formInput}>
                    <option value="">Välj...</option>
                    {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}
                {f.type === 'checkbox' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!answers[f.key]} onChange={e => updateAnswer(f.key, e.target.checked)} /> Ja
                  </label>
                )}
                {f.type === 'date' && <input type="date" value={(answers[f.key] as string) ?? ''} onChange={e => updateAnswer(f.key, e.target.value)} style={formInput} />}
              </div>
            ))}
          </div>

          <button onClick={handleSubmit} disabled={submitting} style={{
            marginTop: 24, width: '100%', padding: '14px 0', borderRadius: 12, fontSize: 15, fontWeight: 700,
            color: '#fff', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none',
            cursor: submitting ? 'wait' : 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
          }}>
            {submitting ? 'Skickar...' : 'Skicka anmälan'}
          </button>
        </div>
      )}
    </div>
  );
}

const formInput: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1px solid #e2e8f0', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' as any,
};
