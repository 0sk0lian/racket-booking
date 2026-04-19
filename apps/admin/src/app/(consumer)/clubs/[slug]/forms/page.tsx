'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const CATS: Record<string, { label: string; color: string }> = {
  junior: { label: 'Junior', color: '#06b6d4' },
  adult: { label: 'Vuxen', color: '#10b981' },
  senior: { label: 'Senior', color: '#f59e0b' },
  camp: { label: 'Läger', color: '#ec4899' },
  competition: { label: 'Tävling', color: '#ef4444' },
};

export default function ClubFormsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/registration-forms?clubId=${slug}&status=open`)
      .then(r => r.json())
      .then(r => { setForms(r.data ?? []); setLoading(false); });
  }, [slug]);

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 24px' }}>
      <Link href={`/clubs/${slug}`} style={{ color: '#6366f1', textDecoration: 'none', fontSize: 13 }}>Tillbaka</Link>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginTop: 8, marginBottom: 20 }}>Anmälningar</h1>

      {loading ? <p style={{ color: '#94a3b8' }}>Laddar...</p> : forms.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          <p style={{ fontSize: 36, marginBottom: 8 }}>📋</p>
          <p>Inga öppna anmälningar just nu.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {forms.map(f => {
            const cat = CATS[f.category] ?? { label: f.category, color: '#64748b' };
            const spotsText = f.spots_remaining !== null && f.spots_remaining !== undefined
              ? `${f.spots_remaining} platser kvar`
              : 'Öppet';
            return (
              <Link key={f.id} href={`/clubs/${slug}/forms/${f.id}`} style={{
                display: 'block', padding: '20px 24px', borderRadius: 14,
                border: '1px solid #e2e8f0', background: '#fff',
                textDecoration: 'none', color: 'inherit', transition: 'all 0.15s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{f.title}</div>
                    {f.description && <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>{f.description}</div>}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 6, background: `${cat.color}15`, color: cat.color }}>{cat.label}</span>
                      {f.season && <span style={{ fontSize: 11, color: '#94a3b8' }}>{f.season}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: f.spots_remaining === 0 ? '#dc2626' : '#059669' }}>
                      {f.spots_remaining === 0 ? 'Fullt' : spotsText}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
