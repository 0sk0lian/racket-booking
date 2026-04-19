'use client';
/**
 * Trainer Schedule — full week view for one trainer.
 * Shows all bookings, training sessions, course sessions with conflict detection.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const API = '/api';
const DAY_NAMES = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];

function toDateStr(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function addDays(s: string, n: number) { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return toDateStr(d); }
function mondayOf(s: string) { const d = new Date(s + 'T12:00:00'); const dow = d.getDay(); d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1)); return toDateStr(d); }

interface ScheduleItem { type: string; id: string; date: string; start_hour: number; end_hour: number; title: string; court_name: string; booking_type: string; }
interface TrainerData { id: string; name: string; email: string; sports: string[]; hourly_rate: number | null; }

export default function TrainerSchedulePage() {
  const { id } = useParams<{ id: string }>();
  const [trainer, setTrainer] = useState<TrainerData | null>(null);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [summary, setSummary] = useState({ total_items: 0, total_hours: 0, estimated_salary: 0 });
  const [weekStart, setWeekStart] = useState(mondayOf(toDateStr(new Date())));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const weekEnd = addDays(weekStart, 6);
    fetch(`${API}/admin/trainers/${id}/schedule?from=${weekStart}&to=${weekEnd}`)
      .then(r => r.json())
      .then(r => {
        setTrainer(r.data?.trainer ?? null);
        setItems(r.data?.items ?? []);
        setConflicts(r.data?.conflicts ?? []);
        setSummary(r.data?.summary ?? { total_items: 0, total_hours: 0, estimated_salary: 0 });
        setLoading(false);
      });
  }, [id, weekStart]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/admin/trainers" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 12 }}>← Tränare</Link>
          <h1 style={{ marginTop: 4 }}>{trainer?.name ?? 'Laddar...'}</h1>
          {trainer && (
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 2 }}>
              {trainer.email} · {(trainer.sports ?? []).join(', ')} · {trainer.hourly_rate ?? 0} SEK/h
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-outline" style={{ padding: '8px 12px', fontSize: 13 }} onClick={() => setWeekStart(addDays(weekStart, -7))}>←</button>
          <button className="btn btn-outline" style={{ padding: '8px 12px', fontSize: 13 }} onClick={() => setWeekStart(mondayOf(toDateStr(new Date())))}>Denna vecka</button>
          <button className="btn btn-outline" style={{ padding: '8px 12px', fontSize: 13 }} onClick={() => setWeekStart(addDays(weekStart, 7))}>→</button>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <Stat label="Tillfällen" value={String(summary.total_items)} />
        <Stat label="Timmar" value={`${summary.total_hours}h`} />
        <Stat label="Lön (est.)" value={`${summary.estimated_salary.toFixed(0)} SEK`} />
      </div>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <div style={{ padding: 14, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#b91c1c', fontSize: 13, marginBottom: 16 }}>
          <strong>Konflikter:</strong>
          {conflicts.map((c, i) => <div key={i} style={{ marginTop: 4 }}>{c}</div>)}
        </div>
      )}

      {loading ? <div className="loading">Laddar schema...</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {days.map(day => {
            const dayItems = items.filter(i => i.date === day);
            const d = new Date(day + 'T12:00:00');
            const isToday = day === toDateStr(new Date());
            return (
              <div key={day} style={{ background: isToday ? '#eef2ff' : 'var(--bg-card)', border: `1px solid ${isToday ? '#a5b4fc' : 'var(--border)'}`, borderRadius: 12, padding: 12, minHeight: 200 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? '#4f46e5' : 'var(--text-muted)', marginBottom: 8 }}>
                  {DAY_NAMES[d.getDay()]} {d.getDate()}/{d.getMonth() + 1}
                </div>
                {dayItems.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>Ledig</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {dayItems.map(item => {
                      const typeColors: Record<string, { bg: string; border: string; text: string }> = {
                        training: { bg: '#eef2ff', border: '#6366f1', text: '#4f46e5' },
                        regular: { bg: '#ecfdf5', border: '#10b981', text: '#059669' },
                        event: { bg: '#fce7f3', border: '#ec4899', text: '#be185d' },
                        contract: { bg: '#fef3c7', border: '#f59e0b', text: '#b45309' },
                        course: { bg: '#f0fdf4', border: '#22c55e', text: '#15803d' },
                      };
                      const c = typeColors[item.booking_type] ?? typeColors.regular;
                      return (
                        <div key={item.id} style={{ padding: '6px 8px', borderRadius: 6, borderLeft: `3px solid ${c.border}`, background: c.bg, fontSize: 11 }}>
                          <div style={{ fontWeight: 700, color: c.text, marginBottom: 2 }}>
                            {String(item.start_hour).padStart(2, '0')}–{String(item.end_hour).padStart(2, '0')}
                          </div>
                          <div style={{ color: c.text, opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                          <div style={{ color: 'var(--text-dim)', fontSize: 10 }}>{item.court_name}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
