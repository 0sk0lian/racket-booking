'use client';
/**
 * Trainer "My Sessions" — shows this week's training sessions grouped by day.
 */
import { useEffect, useState, useCallback } from 'react';

const API = '/api';
const DAY_NAMES = ['Sondag', 'Mandag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lordag'];

interface TrainerProfile {
  id: string;
  full_name: string;
  trainer_club_id: string | null;
}

interface Session {
  id: string;
  title: string;
  court_name: string;
  court_id: string;
  trainer_id: string;
  trainer_name: string;
  day_of_week: number;
  start_hour: number;
  end_hour: number;
  player_ids: string[];
  players: { id: string; name: string }[];
  notes: string | null;
  status: string;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mondayOf(d: Date): Date {
  const clone = new Date(d);
  const dow = clone.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  clone.setDate(clone.getDate() + offset);
  return clone;
}

export default function MySessionsPage() {
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  // Load trainer profile
  useEffect(() => {
    fetch(`${API}/users/me`).then(r => r.json()).then(r => {
      if (r.data) {
        setProfile({
          id: r.data.id,
          full_name: r.data.full_name,
          trainer_club_id: r.data.trainer_club_id,
        });
      }
    });
  }, []);

  // Load sessions
  const loadSessions = useCallback(async () => {
    if (!profile?.trainer_club_id) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/training-planner?clubId=${profile.trainer_club_id}`);
      const data = await r.json();
      // Filter to only this trainer's sessions
      const all: Session[] = (data.data ?? []).filter(
        (s: Session) => s.trainer_id === profile.id && s.status !== 'cancelled'
      );
      setSessions(all);
    } catch {
      setSessions([]);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Week navigation
  const now = new Date();
  const monday = mondayOf(now);
  monday.setDate(monday.getDate() + weekOffset * 7);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  const weekLabel = `${toDateStr(monday)} - ${toDateStr(sunday)}`;

  // Group sessions by day_of_week and sort by Monday-first order
  const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun
  const grouped = dayOrder
    .map(dow => ({
      dow,
      label: DAY_NAMES[dow],
      sessions: sessions.filter(s => s.day_of_week === dow).sort((a, b) => a.start_hour - b.start_hour),
    }))
    .filter(g => g.sessions.length > 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Mina Pass</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 4 }}>
            Dina traningspass denna vecka
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => setWeekOffset(w => w - 1)} style={navBtnStyle}>&larr;</button>
          <button onClick={() => setWeekOffset(0)} style={navBtnStyle}>Denna vecka</button>
          <button onClick={() => setWeekOffset(w => w + 1)} style={navBtnStyle}>&rarr;</button>
        </div>
      </div>

      <div style={{
        fontSize: 13,
        color: 'var(--text-muted)',
        marginBottom: 20,
        fontWeight: 500,
      }}>
        {weekLabel}
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-dim)', padding: 40, textAlign: 'center' }}>Laddar...</div>
      ) : grouped.length === 0 ? (
        <div style={{
          padding: 48,
          textAlign: 'center',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          color: 'var(--text-dim)',
          fontSize: 14,
        }}>
          Inga pass schemalagda denna vecka.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {grouped.map(g => (
            <div key={g.dow}>
              <h2 style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 10,
              }}>
                {g.label}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {g.sessions.map(s => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {!loading && sessions.length > 0 && (
        <div style={{
          marginTop: 28,
          padding: 16,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          display: 'flex',
          gap: 24,
          fontSize: 13,
        }}>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Totalt pass: </span>
            <span style={{ fontWeight: 700 }}>{sessions.length}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Totalt timmar: </span>
            <span style={{ fontWeight: 700 }}>
              {sessions.reduce((sum, s) => sum + (s.end_hour - s.start_hour), 0)}h
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Unika spelare: </span>
            <span style={{ fontWeight: 700 }}>
              {new Set(sessions.flatMap(s => s.player_ids ?? [])).size}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function SessionCard({ session: s }: { session: Session }) {
  const timeStr = `${String(s.start_hour).padStart(2, '0')}:00 - ${String(s.end_hour).padStart(2, '0')}:00`;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 16,
      transition: 'all 0.15s',
      borderLeft: '3px solid #6366f1',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{s.title}</div>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 8,
          background: '#eef2ff',
          color: '#4f46e5',
        }}>
          {s.player_ids?.length ?? 0} spelare
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 16, textAlign: 'center', fontSize: 12 }}>&#128337;</span>
          {timeStr}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 16, textAlign: 'center', fontSize: 12 }}>&#127934;</span>
          {s.court_name}
        </div>
      </div>
      {s.players && s.players.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, fontWeight: 600 }}>Spelare</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {s.players.map(p => (
              <span key={p.id} style={{
                fontSize: 11,
                padding: '2px 8px',
                background: 'var(--bg-body)',
                borderRadius: 6,
                color: 'var(--text-secondary)',
              }}>
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}
      {s.notes && (
        <div style={{
          marginTop: 8,
          fontSize: 12,
          color: 'var(--text-dim)',
          fontStyle: 'italic',
        }}>
          {s.notes}
        </div>
      )}
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: 'var(--text)',
  transition: 'all 0.15s',
};
