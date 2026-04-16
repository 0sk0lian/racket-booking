'use client';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '../../../../lib/supabase/client';

export default function ProfilePage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetch('/api/users/me').then(r => r.json()).then(r => {
      if (r.data) {
        setName(r.data.full_name ?? '');
        setPhone(r.data.phone_number ?? '');
        setEmail(r.data.email ?? '');
        setRole(r.data.role ?? 'player');
      }
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const res = await fetch('/api/users/me', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: name, phone_number: phone }),
    }).then(r => r.json());
    setSaving(false);
    setToast(res.success ? 'Profil uppdaterad!' : (res.error ?? 'Något gick fel'));
    setTimeout(() => setToast(''), 4000);
  };

  const changePassword = async () => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      setToast('Kunde inte skicka återställningslänk');
    } else {
      setToast('Återställningslänk skickad till din e-post');
    }
    setTimeout(() => setToast(''), 4000);
  };

  if (loading) return <div style={{ padding: 40, color: '#94a3b8' }}>Laddar profil...</div>;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 24 }}>Profil</h1>

      {toast && (
        <div style={{ padding: '12px 18px', background: toast.includes('fel') ? '#fef2f2' : '#ecfdf5', border: `1px solid ${toast.includes('fel') ? '#fecaca' : '#a7f3d0'}`, borderRadius: 10, color: toast.includes('fel') ? '#b91c1c' : '#059669', fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
          {toast}
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 28 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#6366f1' }}>
            {name.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{name || 'Unnamed'}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{email}</div>
          </div>
          <span style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: role === 'admin' ? '#eef2ff' : '#f1f5f9', color: role === 'admin' ? '#4f46e5' : '#475569', textTransform: 'capitalize' }}>
            {role}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Namn">
            <input value={name} onChange={e => setName(e.target.value)} style={inp} />
          </Field>
          <Field label="Telefon">
            <input value={phone} onChange={e => setPhone(e.target.value)} style={inp} placeholder="+46 70 123 45 67" />
          </Field>
          <Field label="E-post">
            <input value={email} disabled style={{ ...inp, background: '#f8fafc', color: '#94a3b8' }} />
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>E-post kan inte ändras här. Kontakta support.</div>
          </Field>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={save} disabled={saving} style={{ padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#fff', background: '#6366f1', border: 'none', cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Sparar...' : 'Spara ändringar'}
          </button>
          <button onClick={changePassword} style={{ padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#475569', background: '#f1f5f9', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            Byt lösenord
          </button>
        </div>
      </div>

      <div style={{ marginTop: 32, padding: 20, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#b91c1c', marginBottom: 4 }}>Radera konto</h3>
        <p style={{ fontSize: 12, color: '#dc2626', marginBottom: 10 }}>
          Alla dina bokningar och uppgifter raderas permanent. Denna åtgärd kan inte ångras.
        </p>
        <button style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#dc2626', background: '#fff', border: '1px solid #fecaca', cursor: 'pointer', fontFamily: 'inherit' }}>
          Radera mitt konto (kommer snart)
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
      {children}
    </div>
  );
}

const inp: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14,
  border: '1px solid #e2e8f0', background: '#fff', color: '#1e293b', fontFamily: 'inherit',
};
