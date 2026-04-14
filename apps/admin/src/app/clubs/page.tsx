import { apiGet } from '../api';
import Link from 'next/link';

export default async function ClubsPage() {
  const res = await apiGet<any>('/clubs');
  const clubs = res.data || [];

  return (
    <div>
      <div className="page-header">
        <h1>Clubs</h1>
      </div>

      <div className="stat-grid">
        {clubs.map((club: any) => (
          <Link key={club.id} href={`/clubs/${club.id}`} style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ cursor: 'pointer', transition: 'border-color 0.2s', borderColor: 'var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div className="value" style={{ fontSize: 20 }}>{club.name}</div>
                <span className={`badge ${club.is_non_profit ? 'badge-blue' : 'badge-green'}`}>
                  {club.is_non_profit ? 'Non-Profit' : 'Commercial'}
                </span>
              </div>
              <div className="sub">{club.city || 'Sweden'}</div>
              <div className="sub">Org: {club.organization_number}</div>
              {club.contact_email && <div className="sub">{club.contact_email}</div>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
