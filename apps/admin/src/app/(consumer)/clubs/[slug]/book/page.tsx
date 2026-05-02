'use client';
/**
 * Booking flow — pick date → pick court + time → confirm → booked.
 * Must feel as fast as MATCHi: 3 taps and you're done.
 */
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Court { id: string; name: string; sport_type: string; base_hourly_rate: number; is_indoor: boolean; }
interface Slot { court_id: string; start_hour: number; end_hour: number; date: string; start_iso: string; end_iso: string; }

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const [courts, setCourts] = useState<Court[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [date, setDate] = useState(toDateStr(new Date()));
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/courts?clubId=${slug}`).then(r => r.json()).then(r => setCourts(r.data ?? []));
  }, [slug]);

  useEffect(() => {
    setLoading(true); setSelected(null);
    fetch(`/api/availability?clubId=${slug}&from=${date}&to=${date}&duration=1`)
      .then(r => r.json())
      .then(r => { setSlots(r.data?.slots ?? []); setLoading(false); });
  }, [slug, date]);

  const handleConfirm = async () => {
    if (!selected) return;
    setConfirming(true); setError('');
    const response = await fetch('/api/bookings/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courtId: selected.court_id,
        startTime: selected.start_iso,
        endTime: selected.end_iso,
      }),
    });
    const res = await response.json().catch(() => ({}));

    if (res.success) {
      router.push(`/my/bookings?booked=${res.data.id}`);
      return;
    }

    if (response.status === 401) {
      setConfirming(false);
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      router.push(`/login?next=${next}`);
      return;
    } else {
      setError(res.error ?? 'Bokningen misslyckades');
      setConfirming(false);
    }
  };

  // Group slots by court for display
  const courtSlots = courts.map(court => ({
    court,
    hours: slots
      .filter(s => s.court_id === court.id)
      .sort((a, b) => a.start_hour - b.start_hour),
  }));

  // Date navigation
  const dates: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    dates.push(toDateStr(d));
  }

  const dayName = (d: string) => {
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const selectedCourt = selected ? courts.find(c => c.id === selected.court_id) : null;
  const selectedPrice = selectedCourt ? (selectedCourt.base_hourly_rate * 1.05).toFixed(0) : '0';

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      <Link href={`/clubs/${slug}`} style={{ color: '#6366f1', textDecoration: 'none', fontSize: 13, display: 'inline-block', marginBottom: 16 }}>
        ← Tillbaka till anläggningen
      </Link>

      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 24 }}>Boka tid</h1>

      {/* Date strip */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 24, paddingBottom: 4 }}>
        {dates.map(d => {
          const isToday = d === toDateStr(new Date());
          const isActive = d === date;
          return (
            <button
              key={d}
              onClick={() => setDate(d)}
              style={{
                padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: isActive ? 700 : 500,
                cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
                border: `1.5px solid ${isActive ? '#6366f1' : '#e2e8f0'}`,
                background: isActive ? '#eef2ff' : '#fff',
                color: isActive ? '#4f46e5' : '#475569',
              }}
            >
              {isToday ? 'Idag' : dayName(d)}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>Letar lediga tider...</p>
      ) : (
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          {/* Court columns */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${Math.min(courts.length, 4)}, 1fr)`, gap: 16 }}>
            {courtSlots.map(({ court, hours }) => (
              <div key={court.id}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{court.name}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10, textTransform: 'capitalize' }}>
                  {court.sport_type} · {court.is_indoor ? 'Inomhus' : 'Utomhus'} · {court.base_hourly_rate} SEK/h
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {hours.length === 0 && (
                    <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', padding: 12 }}>Inga lediga tider</div>
                  )}
                  {hours.map(slot => {
                    const isSel = selected?.court_id === slot.court_id && selected?.start_hour === slot.start_hour && selected?.date === slot.date;
                    return (
                      <button
                        key={`${slot.court_id}_${slot.start_hour}`}
                        onClick={() => setSelected(isSel ? null : slot)}
                        style={{
                          padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                          border: `1.5px solid ${isSel ? '#6366f1' : '#e2e8f0'}`,
                          background: isSel ? '#6366f1' : '#fff',
                          color: isSel ? '#fff' : '#1e293b',
                          transition: 'all 0.15s',
                        }}
                      >
                        {String(slot.start_hour).padStart(2, '0')}:00 – {String(slot.end_hour).padStart(2, '0')}:00
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Booking summary sidebar */}
          {selected && (
            <div style={{ width: 320, position: 'sticky', top: 80 }}>
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Din bokning</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  <Row label="Bana" value={selectedCourt?.name ?? ''} />
                  <Row label="Datum" value={dayName(selected.date)} />
                  <Row label="Tid" value={`${String(selected.start_hour).padStart(2, '0')}:00 – ${String(selected.end_hour).padStart(2, '0')}:00`} />
                  <Row label="Sport" value={selectedCourt?.sport_type ?? ''} />
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                    <Row label="Pris" value={`${selectedPrice} SEK`} bold />
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>inkl. 5% plattformsavgift</div>
                  </div>
                </div>

                {error && (
                  <div style={{ padding: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#b91c1c', fontSize: 12, marginBottom: 12 }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  style={{
                    width: '100%', padding: '14px 0', borderRadius: 12, fontSize: 15, fontWeight: 700,
                    color: '#fff', background: confirming ? '#94a3b8' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    border: 'none', cursor: confirming ? 'wait' : 'pointer',
                    boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
                  }}
                >
                  {confirming ? 'Bokar...' : 'Bekräfta bokning'}
                </button>
                <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>
                  Bokningen bekräftas direkt. Onlinebetalning kommer i nästa version.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 500, color: bold ? '#1e293b' : '#475569', textTransform: 'capitalize' }}>{value}</span>
    </div>
  );
}
