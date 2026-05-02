'use client';
import { useEffect, useState } from 'react';

export default function MembershipCardPage() {
  const [user, setUser] = useState<any>(null);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      fetch('/api/users/me').then(r => r.json()),
      fetch('/api/users/me/memberships').then(r => r.json()),
    ]).then(([u, m]) => {
      setUser(u.data);
      setMemberships((m.data ?? []).filter((mem: any) => mem.status === 'active'));
    });
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    // Generate QR codes client-side
    import('qrcode').then(QRCode => {
      QRCode.toDataURL(user.id, { width: 150 }).then((url: string) => {
        setQrCodes(prev => ({ ...prev, [user.id]: url }));
      });
    });
  }, [user]);

  if (!user) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Laddar...</div>;

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Mitt medlemskort</h1>
      {memberships.length === 0 ? (
        <p style={{ color: '#64748b' }}>Du har inga aktiva medlemskap.</p>
      ) : memberships.map((m: any) => (
        <div key={m.id} style={{
          background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
          borderRadius: 16, padding: 28, color: '#fff', marginBottom: 16,
          boxShadow: '0 8px 32px rgba(99,102,241,0.3)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            {m.club_name}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{user.full_name}</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 16 }}>{m.membership_type}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ fontSize: 11, opacity: 0.6 }}>{user.email}</div>
            {qrCodes[user.id] && (
              <img src={qrCodes[user.id]} alt="QR" style={{ width: 80, height: 80, borderRadius: 8, background: '#fff', padding: 4 }} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
