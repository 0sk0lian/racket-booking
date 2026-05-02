'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = '/api';
const TOTAL_STEPS = 4;
const LS_KEY = 'onboarding_complete';

interface Club { id: string; name: string; }
interface Court { id: string; name: string; sport_type: string; is_indoor: boolean; base_hourly_rate: number; }
interface MembershipType { id: string; name: string; price: number; interval: string; }

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubId, setClubId] = useState('');
  const [clubName, setClubName] = useState('');
  const [loading, setLoading] = useState(true);

  // Court form state
  const [courts, setCourts] = useState<Court[]>([]);
  const [courtName, setCourtName] = useState('');
  const [sportType, setSportType] = useState('padel');
  const [isIndoor, setIsIndoor] = useState(false);
  const [hourlyRate, setHourlyRate] = useState('');
  const [addingCourt, setAddingCourt] = useState(false);
  const [courtError, setCourtError] = useState('');

  // Membership form state
  const [membershipTypes, setMembershipTypes] = useState<MembershipType[]>([]);
  const [mtName, setMtName] = useState('');
  const [mtPrice, setMtPrice] = useState('');
  const [mtInterval, setMtInterval] = useState('month');
  const [addingMt, setAddingMt] = useState(false);
  const [mtError, setMtError] = useState('');

  useEffect(() => {
    fetch(`${API}/clubs`).then(r => r.json()).then(r => {
      const data = r.data ?? [];
      setClubs(data);
      if (data.length > 0) {
        setClubId(data[0].id);
        setClubName(data[0].name);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const addCourt = async () => {
    if (!courtName.trim()) { setCourtError('Ange ett namn'); return; }
    setAddingCourt(true);
    setCourtError('');
    const res = await fetch(`${API}/admin/courts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clubId,
        name: courtName.trim(),
        sportType,
        isIndoor,
        baseHourlyRate: Number(hourlyRate) || 0,
      }),
    }).then(r => r.json());

    if (res.success) {
      setCourts(prev => [...prev, res.data]);
      setCourtName('');
      setHourlyRate('');
    } else {
      setCourtError(res.error ?? 'Kunde inte skapa banan');
    }
    setAddingCourt(false);
  };

  const addMembershipType = async () => {
    if (!mtName.trim()) { setMtError('Ange ett namn'); return; }
    setAddingMt(true);
    setMtError('');
    const res = await fetch(`${API}/membership-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clubId,
        name: mtName.trim(),
        price: Number(mtPrice) || 0,
        interval: mtInterval,
      }),
    }).then(r => r.json());

    if (res.success) {
      setMembershipTypes(prev => [...prev, res.data]);
      setMtName('');
      setMtPrice('');
    } else {
      setMtError(res.error ?? 'Kunde inte skapa medlemskap');
    }
    setAddingMt(false);
  };

  const finish = () => {
    try { localStorage.setItem(LS_KEY, 'true'); } catch { /* noop */ }
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>Laddar...</div>;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
      {/* Progress bar */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Steg {step} av {TOTAL_STEPS}</span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{Math.round((step / TOTAL_STEPS) * 100)}%</span>
        </div>
        <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${(step / TOTAL_STEPS) * 100}%`,
            background: 'linear-gradient(90deg, #6366f1, #06b6d4)',
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 32,
        boxShadow: 'var(--shadow-xs)',
      }}>
        {/* Step 1: Welcome */}
        {step === 1 && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>&#127934;</div>
              <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>Valkommen till Racket Booking!</h1>
              <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Lat oss komma igang med att konfigurera din anlaggning.
                Det tar bara nagra minuter.
              </p>
            </div>

            {clubName && (
              <div style={{ textAlign: 'center', padding: 16, background: 'rgba(99,102,241,0.06)', borderRadius: 12, marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Din anlaggning</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{clubName}</div>
              </div>
            )}

            {clubs.length > 1 && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Valj anlaggning</label>
                <select
                  value={clubId}
                  onChange={e => {
                    setClubId(e.target.value);
                    setClubName(clubs.find(c => c.id === e.target.value)?.name ?? '');
                  }}
                  style={inputStyle}
                >
                  {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <button onClick={() => setStep(2)} style={primaryBtn}>
              Nasta &rarr;
            </button>
          </>
        )}

        {/* Step 2: Add courts */}
        {step === 2 && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Lagg till banor</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
              Skapa minst en bana for att kunna borja ta emot bokningar.
            </p>

            {courtError && <div style={errorBox}>{courtError}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Banans namn</label>
                <input
                  type="text"
                  value={courtName}
                  onChange={e => setCourtName(e.target.value)}
                  placeholder="T.ex. Bana 1"
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Sport</label>
                  <select value={sportType} onChange={e => setSportType(e.target.value)} style={inputStyle}>
                    <option value="padel">Padel</option>
                    <option value="tennis">Tennis</option>
                    <option value="squash">Squash</option>
                    <option value="badminton">Badminton</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Typ</label>
                  <select value={isIndoor ? 'indoor' : 'outdoor'} onChange={e => setIsIndoor(e.target.value === 'indoor')} style={inputStyle}>
                    <option value="indoor">Inomhus</option>
                    <option value="outdoor">Utomhus</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Timpris (SEK)</label>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={e => setHourlyRate(e.target.value)}
                  placeholder="0"
                  style={inputStyle}
                />
              </div>
              <button onClick={addCourt} disabled={addingCourt} style={secondaryBtn}>
                {addingCourt ? 'Skapar...' : '+ Lagg till bana'}
              </button>
            </div>

            {courts.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Tillagda banor</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {courts.map(c => (
                    <div key={c.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'var(--bg-body)',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                    }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 8 }}>
                          {c.sport_type} &middot; {c.is_indoor ? 'Inomhus' : 'Utomhus'}
                        </span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#6366f1' }}>
                        {c.base_hourly_rate} kr/h
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)} style={outlineBtn}>&larr; Tillbaka</button>
              <button
                onClick={() => setStep(3)}
                disabled={courts.length === 0}
                style={courts.length === 0 ? { ...primaryBtn, opacity: 0.5, cursor: 'not-allowed' } : primaryBtn}
              >
                Nasta &rarr;
              </button>
            </div>
          </>
        )}

        {/* Step 3: Create membership types */}
        {step === 3 && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Skapa medlemskap</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
              Skapa medlemskapstyper som spelare kan ansoka om. Du kan aven hoppa over detta steg.
            </p>

            {mtError && <div style={errorBox}>{mtError}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Namn</label>
                <input
                  type="text"
                  value={mtName}
                  onChange={e => setMtName(e.target.value)}
                  placeholder="T.ex. Grundmedlemskap"
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Pris (SEK)</label>
                  <input
                    type="number"
                    value={mtPrice}
                    onChange={e => setMtPrice(e.target.value)}
                    placeholder="0"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Intervall</label>
                  <select value={mtInterval} onChange={e => setMtInterval(e.target.value)} style={inputStyle}>
                    <option value="month">Manad</option>
                    <option value="quarter">Kvartal</option>
                    <option value="half_year">Halvar</option>
                    <option value="year">Ar</option>
                    <option value="once">Engangskostnad</option>
                  </select>
                </div>
              </div>
              <button onClick={addMembershipType} disabled={addingMt} style={secondaryBtn}>
                {addingMt ? 'Skapar...' : '+ Skapa medlemskap'}
              </button>
            </div>

            {membershipTypes.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Skapade medlemskap</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {membershipTypes.map(mt => (
                    <div key={mt.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'var(--bg-body)',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                    }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{mt.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#6366f1' }}>
                        {mt.price} kr / {INTERVAL_LABELS[mt.interval] ?? mt.interval}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(2)} style={outlineBtn}>&larr; Tillbaka</button>
              <button onClick={() => setStep(4)} style={outlineBtn}>Hoppa over</button>
              <button onClick={() => setStep(4)} style={primaryBtn}>Nasta &rarr;</button>
            </div>
          </>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>&#9989;</div>
              <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>Klart!</h2>
              <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 8 }}>
                Din anlaggning ar redo att anvandas.
              </p>
              <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 24 }}>
                {courts.length} {courts.length === 1 ? 'bana' : 'banor'} skapade
                {membershipTypes.length > 0 && ` \u00B7 ${membershipTypes.length} medlemskapstyp${membershipTypes.length > 1 ? 'er' : ''}`}
              </p>

              <Link href="/schedule" onClick={finish} style={{
                display: 'inline-block',
                padding: '14px 32px',
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 700,
                color: '#fff',
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
              }}>
                Ga till schemat &rarr;
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const INTERVAL_LABELS: Record<string, string> = {
  month: 'manad',
  quarter: 'kvartal',
  half_year: 'halvar',
  year: 'ar',
  once: 'engang',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  fontSize: 14,
  fontFamily: 'inherit',
  background: 'var(--bg-body)',
  color: 'var(--text)',
  boxSizing: 'border-box',
};

const primaryBtn: React.CSSProperties = {
  flex: 1,
  padding: '12px 0',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 700,
  color: '#fff',
  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
  border: 'none',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
};

const secondaryBtn: React.CSSProperties = {
  padding: '10px 0',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  color: '#6366f1',
  background: 'rgba(99,102,241,0.06)',
  border: '1px solid rgba(99,102,241,0.2)',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const outlineBtn: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text-muted)',
  background: 'transparent',
  border: '1px solid var(--border)',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const errorBox: React.CSSProperties = {
  padding: '10px 16px',
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: 10,
  color: '#dc2626',
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 12,
};
