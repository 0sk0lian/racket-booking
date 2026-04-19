'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

// Top-level nav items — always visible
const mainNav = [
  { href: '/dashboard', label: 'Dashboard', icon: 'D', color: '#6366f1' },
  { href: '/schedule', label: 'Schema', icon: 'S', color: '#06b6d4' },
  { href: '/bookings', label: 'Bokningar', icon: 'B', color: '#10b981' },
];

// Collapsible sections — click the header to go to a hub page, expand to see sub-pages
const collapsible = [
  {
    key: 'ekonomi', label: 'Ekonomi', icon: '$', color: '#10b981',
    hub: '/revenue',
    items: [
      { href: '/revenue', label: 'Omsättning' },
      { href: '/statements', label: 'Statements' },
      { href: '/prices', label: 'Priskalender' },
      { href: '/occupancy', label: 'Beläggning' },
      { href: '/clip-cards', label: 'Klippkort' },
      { href: '/seasons', label: 'Säsonger' },
    ],
  },
  {
    key: 'spelare', label: 'Medlemmar & Matcher', icon: 'P', color: '#0ea5e9',
    hub: '/users',
    items: [
      { href: '/users', label: 'Medlemmar' },
      { href: '/groups', label: 'Grupper' },
      { href: '/registration-forms', label: 'Anmälningar' },
      { href: '/public-matches', label: 'Publika Matcher' },
      { href: '/matches', label: 'Matchlogg' },
      { href: '/leagues', label: 'Ligor' },
      { href: '/tournaments', label: 'Turneringar' },
      { href: '/analytics', label: 'Analytics' },
    ],
  },
  {
    key: 'personal', label: 'Personal', icon: 'H', color: '#8b5cf6',
    hub: '/training-planner',
    items: [
      { href: '/training-planner', label: 'Träningsplanerare' },
      { href: '/courses', label: 'Kurser' },
      { href: '/admin/trainers', label: 'Tränare' },
      { href: '/employee-schedule', label: 'Personalschema' },
      { href: '/employee-time', label: 'Tidrapportering' },
      { href: '/sick-leave', label: 'Sjukanmälan' },
    ],
  },
  {
    key: 'admin', label: 'Administration', icon: 'I', color: '#64748b',
    hub: '/admin/settings',
    items: [
      { href: '/admin/courts', label: 'Banor' },
      { href: '/admin/blackouts', label: 'Stängningar' },
      { href: '/admin/memberships', label: 'Medlemskap' },
      { href: '/admin/settings', label: 'Inställningar' },
      { href: '/admin/manage-clubs', label: 'Alla Klubbar' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);

  // Determine which section is currently open based on pathname
  const getOpenSection = () => {
    for (const sec of collapsible) {
      if (sec.items.some(item => isActive(item.href))) return sec.key;
    }
    return null;
  };

  const [openSection, setOpenSection] = useState<string | null>(getOpenSection);

  const toggleSection = (key: string, hub: string) => {
    if (openSection === key) {
      setOpenSection(null);
    } else {
      setOpenSection(key);
      // Navigate to hub page when opening
      if (!collapsible.find(s => s.key === key)?.items.some(i => isActive(i.href))) {
        router.push(hub);
      }
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">Racket Booking</div>

      {/* Main nav — always visible */}
      <ul className="sidebar-nav" style={{ padding: '0 12px', marginBottom: 4 }}>
        {mainNav.map(n => (
          <li key={n.href}>
            <Link href={n.href} className={isActive(n.href) ? 'active' : ''}>
              <span className="nav-icon" style={{ background: isActive(n.href) ? 'rgba(255,255,255,0.2)' : `${n.color}10`, color: isActive(n.href) ? '#fff' : n.color }}>{n.icon}</span>
              <span style={{ position: 'relative', zIndex: 1 }}>{n.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Collapsible sections */}
      {collapsible.map(sec => {
        const isOpen = openSection === sec.key;
        const sectionActive = sec.items.some(i => isActive(i.href));

        return (
          <div key={sec.key} style={{ marginBottom: 2 }}>
            {/* Section header — clickable */}
            <button
              onClick={() => toggleSection(sec.key, sec.hub)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 10,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14, fontWeight: sectionActive ? 600 : 500,
                color: sectionActive ? 'var(--accent)' : 'var(--text-muted)',
                background: sectionActive ? 'var(--accent-glow)' : 'transparent',
                transition: 'all 0.2s', margin: '0 12px',
                width: 'calc(100% - 24px)',
              }}
            >
              <span style={{
                width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: sectionActive ? `${sec.color}20` : `${sec.color}08`,
                color: sectionActive ? sec.color : sec.color,
                transition: 'all 0.2s',
              }}>{sec.icon}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>{sec.label}</span>
              <span style={{
                fontSize: 10, color: 'var(--text-dim)',
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.25s ease',
              }}>&#9660;</span>
            </button>

            {/* Sub-items — collapsible */}
            <div style={{
              overflow: 'hidden',
              maxHeight: isOpen ? `${sec.items.length * 38 + 8}px` : '0px',
              transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: isOpen ? 1 : 0,
            }}>
              <ul style={{ listStyle: 'none', padding: '4px 12px 4px 42px' }}>
                {sec.items.map(item => (
                  <li key={item.href}>
                    <Link href={item.href} style={{
                      display: 'block', padding: '7px 12px', borderRadius: 8,
                      fontSize: 13, color: isActive(item.href) ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: isActive(item.href) ? 600 : 400,
                      background: isActive(item.href) ? 'var(--accent-glow)' : 'transparent',
                      transition: 'all 0.15s', textDecoration: 'none',
                      borderLeft: isActive(item.href) ? '2px solid var(--accent)' : '2px solid transparent',
                    }}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}

      {/* User */}
      <div className="sidebar-user">
        <div className="sidebar-user-avatar">AD</div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>Admin</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>Club Manager</div>
        </div>
      </div>
    </aside>
  );
}

