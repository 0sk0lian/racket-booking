'use client';
import { useEffect, useState } from 'react';

const API = '/api';

interface Club {
  id: string; name: string; organization_number: string; is_non_profit: boolean;
  timezone: string; stripe_account_id: string | null; contact_email: string | null;
  contact_phone: string | null; address: string | null; city: string | null;
  logo_url: string | null; cover_image_url: string | null; accent_color: string | null; slug: string | null;
}

export default function ClubSettingsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClub, setSelectedClub] = useState('');
  const [club, setClub] = useState<Club | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetch(`${API}/clubs`).then(r => r.json()).then(res => {
      setClubs(res.data || []);
      if (res.data?.length) { setSelectedClub(res.data[0].id); setClub(res.data[0]); }
    });
  }, []);

  useEffect(() => {
    const c = clubs.find(c => c.id === selectedClub);
    if (c) setClub({ ...c });
  }, [selectedClub, clubs]);

  const handleSave = async () => {
    if (!club) return;
    setSaving(true);
    await fetch(`${API}/admin/clubs/${club.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: club.name, isNonProfit: club.is_non_profit,
        contactEmail: club.contact_email, contactPhone: club.contact_phone,
        address: club.address, city: club.city, stripeAccountId: club.stripe_account_id,
        logoUrl: club.logo_url, coverImageUrl: club.cover_image_url,
        accentColor: club.accent_color, slug: club.slug,
      }),
    });
    // Refresh clubs list
    const res = await fetch(`${API}/clubs`).then(r => r.json());
    setClubs(res.data || []);
    setSaving(false);
    setToast('Settings saved'); setTimeout(() => setToast(''), 3000);
  };

  if (!club) return <div className="loading">Loading...</div>;

  return (
    <div>
      <div className="page-header"><h1>Club Settings</h1></div>

      {toast && <div className="toast">{toast}</div>}

      <div style={{ marginBottom: 20 }}>
        <label style={label}>Select Club</label>
        <select value={selectedClub} onChange={e => setSelectedClub(e.target.value)} style={input}>
          {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* General Info */}
        <div style={card}>
          <h3 style={sectionTitle}>General Information</h3>
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Club Name</label>
            <input value={club.name} onChange={e => setClub({ ...club, name: e.target.value })} style={input} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Organization Number</label>
            <input value={club.organization_number} disabled style={{ ...input, opacity: 0.5 }} />
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Cannot be changed after registration</span>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={label}>City</label>
            <input value={club.city || ''} onChange={e => setClub({ ...club, city: e.target.value })} style={input} />
          </div>
          <div>
            <label style={label}>Address</label>
            <input value={club.address || ''} onChange={e => setClub({ ...club, address: e.target.value })} style={input} placeholder="Storgatan 12" />
          </div>
        </div>

        {/* Tax & Financial */}
        <div style={card}>
          <h3 style={sectionTitle}>Tax & Financial</h3>
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Entity Type</label>
            <select value={club.is_non_profit ? 'nonprofit' : 'commercial'} onChange={e => setClub({ ...club, is_non_profit: e.target.value === 'nonprofit' })} style={input}>
              <option value="commercial">Commercial (AB) — 6% VAT on court rental</option>
              <option value="nonprofit">Non-Profit (Ideell förening) — 0% VAT exempt</option>
            </select>
          </div>
          <div style={{ background: club.is_non_profit ? '#0c2d1a' : '#1a1530', border: `1px solid ${club.is_non_profit ? '#16a34a33' : '#7c3aed33'}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: club.is_non_profit ? '#4ade80' : '#818cf8', marginBottom: 8 }}>
              VAT Configuration
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              <div>Court Rental VAT: <strong>{club.is_non_profit ? '0% (Tax-exempt)' : '6%'}</strong></div>
              <div>Platform Fee VAT: <strong>25%</strong> (always)</div>
              {club.is_non_profit && <div style={{ marginTop: 8, color: '#fbbf24', fontSize: 12 }}>Requires 90%+ non-profit activity validation per Skatteverket</div>}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Stripe Account ID</label>
            <input value={club.stripe_account_id || ''} onChange={e => setClub({ ...club, stripe_account_id: e.target.value })} style={input} placeholder="acct_..." />
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Stripe Express account for receiving payouts</span>
          </div>
          <div>
            <label style={label}>Timezone</label>
            <input value={club.timezone} disabled style={{ ...input, opacity: 0.5 }} />
          </div>
        </div>

        {/* Contact */}
        <div style={card}>
          <h3 style={sectionTitle}>Contact Information</h3>
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Email</label>
            <input type="email" value={club.contact_email || ''} onChange={e => setClub({ ...club, contact_email: e.target.value })} style={input} />
          </div>
          <div>
            <label style={label}>Phone</label>
            <input value={club.contact_phone || ''} onChange={e => setClub({ ...club, contact_phone: e.target.value })} style={input} placeholder="+46..." />
          </div>
        </div>

        {/* Branding */}
        <div style={card}>
          <h3 style={sectionTitle}>Branding</h3>
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Slug</label>
            <input value={club.slug || ''} onChange={e => setClub({ ...club, slug: e.target.value })} style={input} placeholder="my-club" />
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>URL-friendly identifier for the club</span>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Logo URL</label>
            <input value={club.logo_url || ''} onChange={e => setClub({ ...club, logo_url: e.target.value })} style={input} placeholder="https://example.com/logo.png" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Cover Image URL</label>
            <input value={club.cover_image_url || ''} onChange={e => setClub({ ...club, cover_image_url: e.target.value })} style={input} placeholder="https://example.com/cover.jpg" />
          </div>
          <div>
            <label style={label}>Accent Color</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={club.accent_color || '#6366f1'} onChange={e => setClub({ ...club, accent_color: e.target.value })} style={{ width: 40, height: 36, padding: 2, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-input)', cursor: 'pointer' }} />
              <input value={club.accent_color || ''} onChange={e => setClub({ ...club, accent_color: e.target.value })} style={input} placeholder="#6366f1" />
            </div>
          </div>
        </div>

        {/* Save */}
        <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: 16 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '12px 32px', fontSize: 16 }}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

const label: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.7px' };
const input: React.CSSProperties = { padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, width: '100%', transition: 'border-color 0.2s', outline: 'none' };
const card: React.CSSProperties = { background: 'var(--bg-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 28 };
const sectionTitle: React.CSSProperties = { fontSize: 16, fontWeight: 600, marginBottom: 22, paddingBottom: 14, borderBottom: '1px solid var(--border)' };
