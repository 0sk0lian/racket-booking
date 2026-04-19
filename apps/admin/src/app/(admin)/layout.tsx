'use client';
import { Sidebar } from './sidebar';
import { GlobalSearch } from '../../components/GlobalSearch';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="layout">
      <Sidebar />
      <main className="main">{children}</main>
      <GlobalSearch />
    </div>
  );
}
