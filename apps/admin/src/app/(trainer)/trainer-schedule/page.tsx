'use client';

import { useCallback, useEffect, useState } from 'react';

const API = '/api';

interface ScheduleItem {
  type: 'booking' | 'course_session';
  id: string;
  date: string;
  start_hour: number;
  end_hour: number;
  title: string;
  court_name: string;
  booking_type: string;
}

interface TrainerData {
  name: string;
  sports: string[];
  hourly_rate: number;
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function mondayOf(date: Date): Date {
  const clone = new Date(date);
  const dow = clone.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  clone.setDate(clone.getDate() + offset);
  return clone;
}

function addDays(date: Date, days: number): Date {
  const clone = new Date(date);
  clone.setDate(clone.getDate() + days);
  return clone;
}

const DAY_NAMES = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
const HOURS = Array.from({ length: 15 }, (_, index) => index + 7);

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  training: { bg: '#eef2ff', border: '#a5b4fc', text: '#4338ca' },
  course: { bg: '#ecfdf5', border: '#6ee7b7', text: '#065f46' },
  regular: { bg: '#f0f9ff', border: '#7dd3fc', text: '#0369a1' },
  event: { bg: '#fdf2f8', border: '#f9a8d4', text: '#9d174d' },
  contract: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
};

export default function TrainerSchedulePage() {
  const [trainerId, setTrainerId] = useState('');
  const [trainer, setTrainer] = useState<TrainerData | null>(null);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  const monday = mondayOf(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);
  const sunday = addDays(monday, 6);
  const from = toDateStr(monday);
  const to = toDateStr(sunday);

  useEffect(() => {
    fetch(`${API}/users/me`)
      .then((response) => response.json())
      .then((response) => {
        if (response.data?.id) setTrainerId(response.data.id);
      });
  }, []);

  const loadSchedule = useCallback(async () => {
    if (!trainerId) return;
    setLoading(true);
    try {
      const response = await fetch(`${API}/admin/trainers/${trainerId}/schedule?from=${from}&to=${to}`).then((r) => r.json());
      if (response.data) {
        setTrainer(response.data.trainer ?? null);
        setItems(response.data.items ?? []);
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, [trainerId, from, to]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    return { date: toDateStr(date), label: DAY_NAMES[index], dayNum: date.getDate() };
  });

  const getItemsForCell = (date: string, hour: number) =>
    items.filter((item) => item.date === date && item.start_hour <= hour && item.end_hour > hour);

  const totalHours = items.reduce((sum, item) => sum + (item.end_hour - item.start_hour), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Schema</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 4 }}>
            {trainer?.name ? `${trainer.name} - ` : ''}Veckoschema
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => setWeekOffset((current) => current - 1)} style={navButtonStyle}>&larr;</button>
          <button onClick={() => setWeekOffset(0)} style={navButtonStyle}>Denna vecka</button>
          <button onClick={() => setWeekOffset((current) => current + 1)} style={navButtonStyle}>&rarr;</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
        <span>{from} - {to}</span>
        <span style={{ fontWeight: 600 }}>{items.length} pass</span>
        <span style={{ fontWeight: 600 }}>{totalHours}h totalt</span>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-dim)', padding: 40, textAlign: 'center' }}>Laddar schema...</div>
      ) : (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
            <div style={headerCellStyle} />
            {weekDays.map((day) => {
              const isToday = day.date === toDateStr(new Date());
              return (
                <div
                  key={day.date}
                  style={{
                    ...headerCellStyle,
                    fontWeight: isToday ? 700 : 600,
                    color: isToday ? 'var(--accent)' : 'var(--text-muted)',
                    background: isToday ? 'var(--accent-glow)' : undefined,
                  }}
                >
                  <div style={{ fontSize: 11 }}>{day.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{day.dayNum}</div>
                </div>
              );
            })}
          </div>

          {HOURS.map((hour) => (
            <div
              key={hour}
              style={{
                display: 'grid',
                gridTemplateColumns: '56px repeat(7, 1fr)',
                borderBottom: '1px solid var(--border)',
                minHeight: 48,
              }}
            >
              <div
                style={{
                  padding: '4px 8px',
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--text-dim)',
                  textAlign: 'right',
                  borderRight: '1px solid var(--border)',
                }}
              >
                {String(hour).padStart(2, '0')}:00
              </div>

              {weekDays.map((day) => {
                const cellItems = getItemsForCell(day.date, hour);
                const isToday = day.date === toDateStr(new Date());
                return (
                  <div
                    key={day.date}
                    style={{
                      padding: 2,
                      borderRight: '1px solid var(--border)',
                      background: isToday ? 'rgba(99,102,241,0.02)' : undefined,
                      minHeight: 48,
                    }}
                  >
                    {cellItems.map((item) => {
                      if (item.start_hour !== hour) return null;
                      const colors = TYPE_COLORS[item.booking_type] ?? TYPE_COLORS.regular;
                      const span = item.end_hour - item.start_hour;
                      return (
                        <div
                          key={item.id}
                          style={{
                            background: colors.bg,
                            border: `1px solid ${colors.border}`,
                            borderRadius: 6,
                            padding: '3px 6px',
                            fontSize: 11,
                            color: colors.text,
                            fontWeight: 600,
                            height: span > 1 ? `calc(${span * 48}px - 4px)` : undefined,
                            overflow: 'hidden',
                            position: 'relative',
                            zIndex: 1,
                          }}
                        >
                          <div style={{ lineHeight: 1.3 }}>{item.title}</div>
                          <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.8 }}>{item.court_name}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const headerCellStyle: React.CSSProperties = {
  padding: '10px 8px',
  textAlign: 'center',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-muted)',
  borderRight: '1px solid var(--border)',
};

const navButtonStyle: React.CSSProperties = {
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
