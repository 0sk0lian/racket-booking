'use client';
import { useEffect, useState, useCallback } from 'react';

interface FriendEntry {
  id: string;
  userId: string;
  friendId: string;
  status: string;
  createdAt: string;
  otherUser: { id: string; fullName: string; email: string } | null;
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [pendingIncoming, setPendingIncoming] = useState<FriendEntry[]>([]);
  const [pendingSent, setPendingSent] = useState<FriendEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState<{ id: string; fullName: string; email: string } | null>(null);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);

  const loadFriends = useCallback(() => {
    fetch('/api/friends')
      .then(r => r.json())
      .then(r => {
        if (r.success) {
          setFriends(r.data.friends ?? []);
          setPendingIncoming(r.data.pendingIncoming ?? []);
          setPendingSent(r.data.pendingSent ?? []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;
    setSearching(true);
    setSearchResult(null);
    setSearchError('');

    try {
      const res = await fetch(`/api/users/search?email=${encodeURIComponent(searchEmail.trim())}`);
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        const user = data.data[0];
        setSearchResult({ id: user.id, fullName: user.full_name ?? user.fullName ?? 'Okänd', email: user.email });
      } else {
        setSearchError('Ingen användare hittades med den e-postadressen');
      }
    } catch {
      setSearchError('Kunde inte söka');
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async (friendId: string) => {
    const res = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendId }),
    });
    const data = await res.json();
    if (data.success) {
      setSearchResult(null);
      setSearchEmail('');
      loadFriends();
    } else {
      setSearchError(data.error ?? 'Kunde inte skicka förfrågan');
    }
  };

  const acceptRequest = async (friendshipId: string) => {
    await fetch('/api/friends', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendshipId, status: 'accepted' }),
    });
    loadFriends();
  };

  const declineRequest = async (friendshipId: string) => {
    await fetch(`/api/friends?id=${friendshipId}`, { method: 'DELETE' });
    loadFriends();
  };

  const removeFriend = async (friendshipId: string) => {
    if (!confirm('Ta bort vän?')) return;
    await fetch(`/api/friends?id=${friendshipId}`, { method: 'DELETE' });
    loadFriends();
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Mina vänner</h1>
      <p style={{ fontSize: 14, color: '#64748b', marginBottom: 28 }}>Hantera dina vänner och förfrågningar.</p>

      {loading ? <p style={{ color: '#94a3b8' }}>Laddar...</p> : (
        <>
          {/* Add friend search */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, marginBottom: 28 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#1e293b' }}>Lägg till vän</h3>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
              <input
                type="email"
                value={searchEmail}
                onChange={e => setSearchEmail(e.target.value)}
                placeholder="Sök med e-postadress..."
                style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }}
              />
              <button
                type="submit"
                disabled={searching}
                style={{
                  padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  color: '#fff', background: '#6366f1', border: 'none', cursor: 'pointer',
                  opacity: searching ? 0.6 : 1,
                }}
              >
                {searching ? 'Söker...' : 'Sök'}
              </button>
            </form>
            {searchError && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{searchError}</p>}
            {searchResult && (
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{searchResult.fullName}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{searchResult.email}</div>
                </div>
                <button
                  onClick={() => sendRequest(searchResult.id)}
                  style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', background: '#6366f1', border: 'none', cursor: 'pointer' }}
                >
                  Skicka förfrågan
                </button>
              </div>
            )}
          </div>

          {/* Pending incoming requests */}
          {pendingIncoming.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Förfrågningar ({pendingIncoming.length})</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingIncoming.map(req => (
                  <div key={req.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{req.otherUser?.fullName ?? 'Okänd'}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{req.otherUser?.email ?? ''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => acceptRequest(req.id)}
                        style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', background: '#059669', border: 'none', cursor: 'pointer' }}
                      >
                        Acceptera
                      </button>
                      <button
                        onClick={() => declineRequest(req.id)}
                        style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', cursor: 'pointer' }}
                      >
                        Avvisa
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending sent requests */}
          {pendingSent.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Skickade ({pendingSent.length})</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingSent.map(req => (
                  <div key={req.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{req.otherUser?.fullName ?? 'Okänd'}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{req.otherUser?.email ?? ''}</div>
                    </div>
                    <span style={{ padding: '5px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, background: '#fef3c7', color: '#b45309' }}>Väntar</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accepted friends */}
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Vänner ({friends.length})</h2>
            {friends.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                <p style={{ fontSize: 42, marginBottom: 8 }}>👥</p>
                <h3 style={{ color: '#334155' }}>Inga vänner än</h3>
                <p>Sök efter en vän med e-postadress ovan.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {friends.map(f => (
                  <div key={f.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#6366f1' }}>
                        {(f.otherUser?.fullName || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{f.otherUser?.fullName ?? 'Okänd'}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{f.otherUser?.email ?? ''}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFriend(f.id)}
                      style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0', cursor: 'pointer' }}
                    >
                      Ta bort
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
