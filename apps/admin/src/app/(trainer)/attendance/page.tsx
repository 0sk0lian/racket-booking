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

interface AttendanceRow {
  user_id: string;
  full_name: string;
  status: string;
  booking_id: string;
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function AttendancePage() {
  const [trainerId, setTrainerId] = useState('');
  const [todayItems, setTodayItems] = useState<ScheduleItem[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const today = toDateStr(new Date());

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
      const response = await fetch(`${API}/admin/trainers/${trainerId}/schedule?from=${today}&to=${today}`).then((r) => r.json());
      const items: ScheduleItem[] = (response.data?.items ?? []).filter((item: ScheduleItem) => item.type === 'booking');
      setTodayItems(items);

      const map: Record<string, AttendanceRow[]> = {};
      await Promise.all(items.map(async (item) => {
        try {
          const attendanceResponse = await fetch(`${API}/bookings/${item.id}/attendance`).then((r) => r.json());
          map[item.id] = (attendanceResponse.data ?? []).map((row: any) => ({
            user_id: row.user_id,
            full_name: row.full_name ?? 'Okänd spelare',
            status: row.status,
            booking_id: item.id,
          }));
        } catch {
          map[item.id] = [];
        }
      }));
      setAttendanceMap(map);
    } catch {
      setTodayItems([]);
      setAttendanceMap({});
    }
    setLoading(false);
  }, [trainerId, today]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const toggleAttendance = async (bookingId: string, userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'present' ? 'no_show' : 'present';
    setSaving(`${bookingId}-${userId}`);
    try {
      await fetch(`${API}/bookings/${bookingId}/attendance/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      setAttendanceMap((current) => ({
        ...current,
        [bookingId]: (current[bookingId] ?? []).map((row) =>
          row.user_id === userId ? { ...row, status: newStatus } : row
        ),
      }));
    } finally {
      setSaving(null);
    }
  };

  const markAllPresent = async (bookingId: string) => {
    const rows = attendanceMap[bookingId] ?? [];
    const userIds = rows.filter((row) => row.status !== 'present').map((row) => row.user_id);
    if (userIds.length === 0) return;

    setSaving(bookingId);
    try {
      await fetch(`${API}/bookings/${bookingId}/attendance/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'present', userIds }),
      });
      setAttendanceMap((current) => ({
        ...current,
        [bookingId]: (current[bookingId] ?? []).map((row) =>
          userIds.includes(row.user_id) ? { ...row, status: 'present' } : row
        ),
      }));
    } finally {
      setSaving(null);
    }
  };

  const nowHour = new Date().getHours();

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Närvaro</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 4 }}>
          {new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })} - markera närvaro för dagens pass.
        </p>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-dim)', padding: 40, textAlign: 'center' }}>Laddar pass...</div>
      ) : todayItems.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            color: 'var(--text-dim)',
            fontSize: 14,
          }}
        >
          Inga pass idag.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {todayItems
            .sort((a, b) => a.start_hour - b.start_hour)
            .map((item) => {
              const rows = attendanceMap[item.id] ?? [];
              const presentCount = rows.filter((row) => row.status === 'present').length;
              const isPast = item.end_hour <= nowHour;
              const isCurrent = item.start_hour <= nowHour && item.end_hour > nowHour;
              const timeStr = `${String(item.start_hour).padStart(2, '0')}:00 - ${String(item.end_hour).padStart(2, '0')}:00`;

              return (
                <div
                  key={item.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: `1px solid ${isCurrent ? 'var(--accent-light)' : 'var(--border)'}`,
                    borderRadius: 14,
                    overflow: 'hidden',
                    boxShadow: isCurrent ? '0 0 0 2px var(--accent-glow)' : undefined,
                    opacity: isPast ? 0.7 : 1,
                  }}
                >
                  <div
                    style={{
                      padding: '14px 18px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--border)',
                      background: isCurrent ? 'var(--accent-glow)' : undefined,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                        {item.title}
                        {isCurrent && (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 8,
                              background: '#10b981',
                              color: '#fff',
                            }}
                          >
                            Pågår nu
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                        {timeStr} &middot; {item.court_name}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: presentCount === rows.length && rows.length > 0 ? '#10b981' : 'var(--text-muted)',
                        }}
                      >
                        {presentCount}/{rows.length}
                      </span>
                      <button
                        onClick={() => markAllPresent(item.id)}
                        disabled={saving === item.id}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-card)',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          color: 'var(--accent)',
                        }}
                      >
                        Markera alla närvarande
                      </button>
                    </div>
                  </div>

                  {rows.length === 0 ? (
                    <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--text-dim)' }}>
                      Ingen deltagarlista tillgänglig.
                    </div>
                  ) : (
                    <div>
                      {rows.map((row, index) => {
                        const isPresent = row.status === 'present';
                        const isNoShow = row.status === 'no_show';
                        const isSavingThis = saving === `${item.id}-${row.user_id}`;
                        return (
                          <div
                            key={row.user_id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '10px 18px',
                              borderBottom: index < rows.length - 1 ? '1px solid var(--border)' : undefined,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: '50%',
                                  background: isPresent ? '#ecfdf5' : isNoShow ? '#fef2f2' : 'var(--bg-body)',
                                  border: `2px solid ${isPresent ? '#10b981' : isNoShow ? '#ef4444' : 'var(--border)'}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 14,
                                }}
                              >
                                {isPresent ? '✓' : isNoShow ? '✕' : '·'}
                              </div>
                              <span
                                style={{
                                  fontWeight: 500,
                                  fontSize: 14,
                                  color: isPresent ? 'var(--text)' : isNoShow ? 'var(--text-dim)' : 'var(--text-secondary)',
                                  textDecoration: isNoShow ? 'line-through' : undefined,
                                }}
                              >
                                {row.full_name}
                              </span>
                            </div>
                            <button
                              onClick={() => toggleAttendance(item.id, row.user_id, row.status)}
                              disabled={isSavingThis}
                              style={{
                                padding: '5px 12px',
                                borderRadius: 6,
                                border: 'none',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                background: isPresent ? '#10b981' : isNoShow ? '#ef4444' : 'var(--bg-body)',
                                color: isPresent || isNoShow ? '#fff' : 'var(--text-muted)',
                              }}
                            >
                              {isSavingThis ? '...' : isPresent ? 'Närvarande' : isNoShow ? 'Ej närvarande' : 'Markera'}
                            </button>
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
