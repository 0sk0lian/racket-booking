'use client';
import { useEffect, useState } from 'react';
const API = '/api';

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Tournaments don't have a dedicated Route Handler yet — show empty state
    setLoading(false);
  }, []);

  return (
    <div>
      <div className="page-header"><h1>Turneringar</h1></div>
      {loading ? <div className="loading">Laddar...</div> : (
        <div className="empty-state">
          <p style={{ fontSize: 42, marginBottom: 8 }}>🏆</p>
          <h3>Turneringar</h3>
          <p style={{ color: 'var(--text-dim)', marginTop: 4 }}>Americano- och Mexicano-turneringar. Kommer snart.</p>
        </div>
      )}
    </div>
  );
}
