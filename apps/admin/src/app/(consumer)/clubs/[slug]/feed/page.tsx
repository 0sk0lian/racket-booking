'use client';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface Post {
  id: string;
  club_id: string;
  author_id: string;
  author_name: string;
  content: string;
  pinned: boolean;
  created_at: string;
}

interface Club {
  id: string;
  slug?: string | null;
  name: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just nu';
  if (mins < 60) return `${mins} min sedan`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} tim sedan`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} dag${days > 1 ? 'ar' : ''} sedan`;
  return new Date(dateStr).toLocaleDateString('sv-SE');
}

export default function ClubFeedPage() {
  const { slug } = useParams<{ slug: string }>();
  const [club, setClub] = useState<Club | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [pinned, setPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadFeed = useCallback((clubId: string) => {
    fetch(`/api/clubs/${clubId}/feed`)
      .then(r => r.json())
      .then(r => setPosts(r.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Find club by slug
    fetch('/api/clubs')
      .then(r => r.json())
      .then(clubsRes => {
        const found = (clubsRes.data ?? []).find((c: Club) => c.id === slug || c.slug === slug);
        setClub(found ?? null);
        if (found) {
          loadFeed(found.id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Check if user is admin
    fetch('/api/users/me')
      .then(r => r.json())
      .then(r => {
        if (r.data?.role === 'admin' || r.data?.role === 'superadmin') {
          setIsAdmin(true);
        }
      })
      .catch(() => {});
  }, [slug, loadFeed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() || !club) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/clubs/${club.id}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent.trim(), pinned }),
      });
      if (res.ok) {
        setNewContent('');
        setPinned(false);
        loadFeed(club.id);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!club || !confirm('Ta bort inlägget?')) return;
    await fetch(`/api/clubs/${club.id}/feed?postId=${postId}`, { method: 'DELETE' });
    loadFeed(club.id);
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Laddar...</div>;
  if (!club) return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <h2>Klubben hittades inte</h2>
      <Link href="/clubs" style={{ color: '#6366f1' }}>Tillbaka</Link>
    </div>
  );

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 24px' }}>
      <Link href={`/clubs/${slug}`} style={{ color: '#6366f1', textDecoration: 'none', fontSize: 13, display: 'inline-block', marginBottom: 12 }}>
        &larr; Tillbaka till {club.name}
      </Link>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Nyheter</h1>
      <p style={{ fontSize: 14, color: '#64748b', marginBottom: 28 }}>Senaste nytt från {club.name}</p>

      {/* Admin form */}
      {isAdmin && (
        <form onSubmit={handleSubmit} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, marginBottom: 28 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#1e293b' }}>Skriv inlägg</h3>
          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            placeholder="Skriv ett meddelande till medlemmarna..."
            rows={3}
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <label style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} />
              Fäst inlägg
            </label>
            <button
              type="submit"
              disabled={submitting || !newContent.trim()}
              style={{
                padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700,
                color: '#fff', background: submitting ? '#94a3b8' : '#6366f1',
                border: 'none', cursor: submitting ? 'default' : 'pointer',
              }}
            >
              {submitting ? 'Skickar...' : 'Publicera'}
            </button>
          </div>
        </form>
      )}

      {/* Posts list */}
      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          <p style={{ fontSize: 42, marginBottom: 8 }}>📰</p>
          <h3 style={{ color: '#334155' }}>Inga inlägg än</h3>
          <p>Klubben har inte publicerat några nyheter.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {posts.map(post => (
            <div key={post.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, position: 'relative' }}>
              {post.pinned && (
                <span style={{ position: 'absolute', top: 12, right: 12, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: '#fef3c7', color: '#b45309' }}>
                  Fäst
                </span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#6366f1' }}>
                  {(post.author_name || '?')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{post.author_name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{timeAgo(post.created_at)}</div>
                </div>
              </div>
              <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>{post.content}</p>
              {isAdmin && (
                <button
                  onClick={() => handleDelete(post.id)}
                  style={{ marginTop: 12, padding: '4px 12px', borderRadius: 6, fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', cursor: 'pointer' }}
                >
                  Ta bort
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
