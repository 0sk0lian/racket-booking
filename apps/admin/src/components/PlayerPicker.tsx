'use client';
/**
 * PlayerPicker — group-aware chip picker.
 *
 * Shows master categories (e.g. "Junior") → child groups (e.g. "Junior U12") →
 * individual players. Clicking a player toggles them in `selected`. An "All"
 * button on a group adds every member of that group at once.
 *
 * Extracted from apps/admin/src/app/training-planner/page.tsx so both the
 * Schedule page and the Training Planner can use the same picker.
 */
import { useState, CSSProperties } from 'react';

export interface PickerUser { id: string; full_name: string; }
export interface PickerGroup {
  id: string;
  name: string;
  category: string;
  parent_group_id: string | null;
  is_master_category: boolean;
  child_groups?: { id: string; name: string; player_count: number }[];
  player_ids: string[];
  players: { id: string; full_name: string }[];
}

export interface PlayerPickerProps {
  users: PickerUser[];
  groups: PickerGroup[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Palette — defaults to the training-indigo palette. */
  accent?: { border: string; bg: string; text: string };
}

export function PlayerPicker({
  users, groups, selected, onChange,
  accent = { border: '#10b981', bg: '#ecfdf5', text: '#059669' },
}: PlayerPickerProps) {
  const [pickerCategory, setPickerCategory] = useState('');
  const [pickerGroup, setPickerGroup] = useState('');

  const masterCategories = groups.filter(g => g.is_master_category);
  const topGroups = groups.filter(g => !g.parent_group_id && !g.is_master_category && g.player_ids.length > 0);

  const getChildGroups = (pid: string) => groups.filter(g => g.parent_group_id === pid);
  const getGroupPlayers = (gid: string) => groups.find(g => g.id === gid)?.players ?? [];

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  const addGroupPlayers = (gid: string) => {
    const g = groups.find(x => x.id === gid);
    if (g) onChange([...new Set([...selected, ...g.player_ids])]);
  };

  return (
    <div style={panelStyle}>
      <div style={sectionHdr}>Välj spelare från grupper</div>

      {/* Row 1: master categories + top-level groups */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {masterCategories.map(cat => {
          const active = pickerCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => { setPickerCategory(active ? '' : cat.id); setPickerGroup(''); }}
              style={{
                ...chipStyle,
                borderColor: active ? '#6366f1' : 'var(--border)',
                background: active ? '#eef2ff' : '#fff',
                color: active ? '#4f46e5' : 'var(--text-muted)',
              }}
            >
              {cat.name} ({cat.child_groups?.length ?? 0})
            </button>
          );
        })}
        {topGroups.map(g => {
          const active = pickerGroup === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => { setPickerCategory(''); setPickerGroup(active ? '' : g.id); }}
              style={{
                ...chipStyle,
                borderColor: active ? accent.border : 'var(--border)',
                background: active ? accent.bg : '#fff',
                color: active ? accent.text : 'var(--text-muted)',
              }}
            >
              {g.name} ({g.player_ids.length})
            </button>
          );
        })}
      </div>

      {/* Row 2: child groups for active category */}
      {pickerCategory && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {getChildGroups(pickerCategory).map(g => {
            const active = pickerGroup === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setPickerGroup(active ? '' : g.id)}
                style={{
                  ...chipStyle,
                  fontSize: 11,
                  borderColor: active ? accent.border : 'var(--border)',
                  background: active ? accent.bg : '#fff',
                  color: active ? accent.text : 'var(--text-secondary)',
                }}
              >
                {g.name} ({g.player_ids.length})
              </button>
            );
          })}
        </div>
      )}

      {/* Row 3: players of the active group */}
      {pickerGroup && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)' }}>Spelare</span>
            <button
              type="button"
              onClick={() => addGroupPlayers(pickerGroup)}
              style={{
                padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${accent.border}`, background: accent.bg, color: accent.text,
                fontFamily: 'inherit',
              }}
            >
              Alla
            </button>
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {getGroupPlayers(pickerGroup).map(p => {
              const on = selected.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  style={{
                    ...chipStyle,
                    fontSize: 11,
                    borderColor: on ? accent.border : '#e2e8f0',
                    background: on ? accent.bg : '#fff',
                    color: on ? accent.text : 'var(--text-muted)',
                  }}
                >
                  {p.full_name}{on && ' \u2713'}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Currently selected — pills for quick removal */}
      {selected.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
            Valda ({selected.length}):{' '}
          </span>
          {selected.map(id => {
            const u = users.find(x => x.id === id);
            return (
              <span
                key={id}
                onClick={() => toggle(id)}
                style={{
                  padding: '2px 8px', borderRadius: 10, fontSize: 10,
                  background: accent.bg, color: accent.text,
                  border: `1px solid ${accent.border}`,
                  cursor: 'pointer', marginRight: 4, display: 'inline-block', marginBottom: 2,
                }}
              >
                {u?.full_name ?? '?'} &times;
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

const panelStyle: CSSProperties = {
  background: 'var(--bg-body)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 14,
};
const sectionHdr: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.7,
  marginBottom: 8,
};
const chipStyle: CSSProperties = {
  padding: '5px 12px',
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  border: '1.5px solid var(--border)',
  transition: 'all 0.15s',
  fontFamily: 'inherit',
};
