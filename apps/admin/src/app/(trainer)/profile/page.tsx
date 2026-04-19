'use client';
/**
 * Trainer Profile — view and edit basic profile info.
 */
import { useEffect, useState } from 'react';

const API = '/api';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  trainer_club_id: string | null;
  trainer_sport_types: string[];
  trainer_hourly_rate: number | null;
  trainer_monthly_salary: number | null;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetch(`${API}/users/me`).then(r => r.json()).then(r => {
      if (r.data) {
        setProfile(r.data);
        setName(r.data.full_name ?? '');
        setPhone(r.data.phone_number ?? '');
      }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name, phone_number: phone }),
      });
      const json = await r.json();
      if (json.success) {
        setToast('Profil uppdaterad');
        setTimeout(() => setToast(''), 3000);
      }
    } catch {
      setToast('Något gick fel');
      setTimeout(() => setToast(''), 3000);
    }
    setSaving(false);
  };

  if (!profile) {
    return <div style={{ color: 'var(--text-dim)', padding: 40, textAlign: 'center' }}>Laddar...</div>;
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, marginBottom: 24 }}>Min Profil</h1>

      {toast && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          padding: '10px 20px',
          background: '#10b981',
          color: '#fff',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          zIndex: 100,
          boxShadow: 'var(--shadow-md)',
        }}>
          {toast}
        </div>
      )}

      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 24,
        maxWidth: 520,
      }}>
        {/* Read-only info */}
        <div style={{ marginBottom: 20 }}>
          <div style={readOnlyRowStyle}>
            <span style={labelStyle}>E-post</span>
            <span style={valueStyle}>{profile.email}</span>
          </div>
          <div style={readOnlyRowStyle}>
            <span style={labelStyle}>Roll</span>
            <span style={{
              ...valueStyle,
              padding: '2px 10px',
              background: '#eef2ff',
              borderRadius: 8,
              color: '#4f46e5',
              fontWeight: 600,
              fontSize: 12,
            }}>
              Tranare
            </span>
          </div>
          {profile.trainer_sport_types && profile.trainer_sport_types.length > 0 && (
            <div style={readOnlyRowStyle}>
              <span style={labelStyle}>Sporter</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {profile.trainer_sport_types.map(s => (
                  <span key={s} style={{
                    padding: '2px 10px',
                    background: 'var(--bg-body)',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    textTransform: 'capitalize',
                  }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {profile.trainer_hourly_rate && (
            <div style={readOnlyRowStyle}>
              <span style={labelStyle}>Timpris</span>
              <span style={valueStyle}>{profile.trainer_hourly_rate} SEK/h</span>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: 'var(--text-secondary)' }}>
            Redigera
          </h2>

          <div style={{ marginBottom: 14 }}>
            <label style={inputLabelStyle}>Namn</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={inputLabelStyle}>Telefon</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              style={inputStyle}
              placeholder="+46..."
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 24px',
              borderRadius: 10,
              border: 'none',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              background: 'var(--accent-gradient)',
              color: '#fff',
              transition: 'all 0.15s',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Sparar...' : 'Spara'}
          </button>
        </div>
      </div>
    </div>
  );
}

const readOnlyRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 0',
  borderBottom: '1px solid var(--border)',
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-muted)',
};

const valueStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text)',
};

const inputLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  fontSize: 14,
  fontFamily: 'inherit',
  background: 'var(--bg-input)',
  color: 'var(--text)',
  transition: 'border 0.15s',
  outline: 'none',
};
