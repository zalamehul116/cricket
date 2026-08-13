'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Trophy, Users, ShieldAlert, BadgeDollarSign, LogIn, LogOut, Menu, X, Shield } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<{ loggedIn: boolean; role?: 'admin' | 'team'; name?: string } | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.success) {
        setSession(data);
      }
    } catch (err) {
      console.error('Error fetching session:', err);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [pathname]); // Refresh session state on route changes

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSession({ loggedIn: false });
        router.push('/login');
        router.refresh();
      }
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };

  const navItems = [
    { href: '/', label: 'Live Auction', icon: Trophy },
    { href: '/players', label: 'Players Database', icon: Users },
    { href: '/teams', label: 'Teams & Captains', icon: ShieldAlert },
  ];

  if (session?.loggedIn && session?.role === 'team') {
    // Add Team Dashboard to front of nav items
    navItems.unshift({ href: '/team-dashboard', label: 'Team Dashboard', icon: Users });
  }

  if (session?.loggedIn && session?.role === 'admin') {
    // Add Auctions Management to end of nav items
    navItems.push({ href: '/auctions', label: 'Manage Auctions', icon: ShieldAlert });
  }

  return (
    <nav className="navbar">
      <div className="nav-header">
        <div className="nav-brand">
          <BadgeDollarSign className="w-8 h-8 text-amber-500 animate-pulse" style={{ color: '#f59e0b', width: '2rem', height: '2rem' }} />
          <span style={{ fontWeight: 800, letterSpacing: '1px' }}>CRICKET AUCTION 2026</span>
        </div>

        {/* Mobile Hamburger Button */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="mobile-menu-btn"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      
      <div className={`nav-menu-container ${isOpen ? 'nav-menu-open' : ''}`}>
        <div className="nav-links">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="nav-user-section">
          {session?.loggedIn ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {session.role === 'admin' ? (
                <Link
                  href="/admin/profile"
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--primary)',
                    fontWeight: 600,
                    textDecoration: 'none',
                    borderBottom: '1px dashed var(--primary)',
                    paddingBottom: '2px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <Shield size={12} />
                  <span>Admin Profile</span>
                </Link>
              ) : (
                <span style={{ fontSize: '0.8rem', color: 'var(--info)', fontWeight: 600 }}>
                  {session.name}
                </span>
              )}
              <button
                onClick={() => { handleLogout(); setIsOpen(false); }}
                className="btn btn-secondary"
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  borderColor: 'rgba(239,68,68,0.2)',
                  color: 'var(--danger)'
                }}
              >
                <LogOut size={14} />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="btn btn-primary"
              style={{
                padding: '0.4rem 1rem',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <LogIn size={14} />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
