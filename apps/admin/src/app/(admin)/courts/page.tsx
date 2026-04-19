'use client';
import { useEffect, useState } from 'react';
const API = '/api';

export default function CourtsPage() {
  const [courts, setCourts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/courts`).then(r => r.json()).then(r => { setCourts(r.data ?? []); setLoading(false); });
  }, []);

  return (
    <div>
      <div className="page-header"><h1>Banor</h1></div>
      {loading ? <div className="loading">Laddar...</div> : courts.length === 0 ? (
        <div className="empty-state"><h3>Inga banor</h3></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {courts.map(c => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{c.sport_type} · {c.is_indoor ? 'Inomhus' : 'Utomhus'}</div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#6366f1' }}>{c.base_hourly_rate} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-dim)' }}>SEK/h</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
