'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, Smartphone, Globe, Shield, Coins, CheckCircle2, XCircle, Award, Calendar, RefreshCw } from 'lucide-react';
import { getDirectDriveUrl, formatCurrency } from '@/lib/utils';
import ImageKitImage from '@/components/ImageKitImage';

interface AuctionHistoryItem {
  auctionName: string;
  auctionStatus: string;
  status: string;
  team: string;
  soldPrice: string | number;
}

interface PlayerDetails {
  id: number;
  name: string;
  mobile: string;
  playingRole: string;
  playingAs: string;
  playerPhoto: string;
  status: string;
  team: string;
  soldPrice: string | number;
  history?: AuctionHistoryItem[];
}

export default function PlayerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const uuidParam = params.uuid ? decodeURIComponent(params.uuid as string) : '';

  const [player, setPlayer] = useState<PlayerDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<{ loggedIn: boolean; role?: 'admin' | 'team'; name?: string } | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data.success) {
          setSession(data);
        }
      } catch (err) {
        console.error(err);
      }
    };

    const fetchPlayerData = async () => {
      if (!uuidParam) return;
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/players?mobile=${encodeURIComponent(uuidParam)}`);
        const data = await res.json();
        if (data.success && data.data) {
          setPlayer(data.data);
        } else {
          setError(data.error || 'Failed to retrieve player profile.');
        }
      } catch (err) {
        console.error(err);
        setError('Network error fetching player profile.');
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
    fetchPlayerData();
  }, [uuidParam]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Sold':
        return (
          <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
            <CheckCircle2 size={12} />
            <span>Sold</span>
          </span>
        );
      case 'Unsold':
        return (
          <span className="badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
            <XCircle size={12} />
            <span>Unsold</span>
          </span>
        );
      case 'Captain':
        return (
          <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--primary)', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
            <Award size={12} />
            <span>Captain</span>
          </span>
        );
      default:
        return (
          <span className="badge" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
            <Calendar size={12} />
            <span>Available</span>
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-secondary)' }}>
        <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 1rem', display: 'block', color: 'var(--primary)' }} />
        <span>Loading player profile...</span>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="glass-panel animate-slide-up" style={{ maxWidth: '500px', margin: '4rem auto', padding: '3rem 2rem', textAlign: 'center', border: '1px solid var(--danger)' }}>
        <XCircle size={48} style={{ color: 'var(--danger)', marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Error Loading Profile</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          {error || 'Player profile not found.'}
        </p>
        <button onClick={() => router.push('/players')} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowLeft size={16} />
          <span>Back to Players</span>
        </button>
      </div>
    );
  }

  return (
    <div className="animate-slide-up" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '4rem' }}>
      {/* Back navigation */}
      <button 
        onClick={() => router.push('/players')} 
        className="btn btn-secondary" 
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <ArrowLeft size={16} />
        <span>Back to Players List</span>
      </button>

      {/* Main Profile Panel */}
      <div className="glass-panel" style={{ padding: '2.5rem', marginBottom: '2rem', border: '1px solid var(--border-color-glow)' }}>
        <div className="profile-layout">
          {/* Avatar Area */}
          <div style={{ 
            width: '140px', 
            height: '140px', 
            borderRadius: '24px', 
            overflow: 'hidden', 
            border: player.status === 'Captain' ? '3px solid var(--primary)' : '3px solid rgba(255, 255, 255, 0.1)', 
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
            flexShrink: 0 
          }}>
            <ImageKitImage 
              src={player.playerPhoto ? getDirectDriveUrl(player.playerPhoto) : 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200'} 
              alt={player.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200';
              }}
            />
          </div>

          {/* Core Info */}
          <div style={{ flex: 1, minWidth: '250px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <h1 className="page-title" style={{ margin: 0 }}>
                {player.name}
              </h1>
            </div>

            {/* Quick Badges */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              <span className="badge" style={{ backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', fontWeight: 600, padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>
                {player.playingRole}
              </span>
              <span className="badge" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', padding: '0.3rem 0.6rem', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                {player.playingAs}
              </span>
            </div>

            {/* Contact Detail */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <Smartphone size={16} style={{ color: 'var(--primary)' }} />
                <span style={{ fontWeight: 500 }}>Mobile No:</span>
                <span style={{ color: 'var(--text-primary)' }}>{player.mobile}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cross-Auction History Table */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Coins size={20} style={{ color: 'var(--primary)' }} />
          <span>Auction Tournament Status</span>
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Real-time status and bidding results for this player across all auction rooms.
        </p>

        {(!player.history || player.history.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <Globe size={36} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.5 }} />
            <span>This player is not assigned to any auction pool yet.</span>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>Auction Room</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>Assigned Team</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'right' }}>Sold Price</th>
                </tr>
              </thead>
              <tbody>
                {player.history.map((h, idx) => (
                  <tr 
                    key={`${h.auctionName}-${idx}`} 
                    style={{ 
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      backgroundColor: h.auctionStatus === 'Active' ? 'rgba(245, 158, 11, 0.02)' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{h.auctionName}</span>
                        {h.auctionStatus === 'Active' && (
                          <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--primary)', fontSize: '0.65rem', padding: '0.1rem 0.3rem', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                            Active
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>{getStatusBadge(h.status)}</td>
                    <td style={{ padding: '1rem', color: h.team ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: h.team ? 600 : 400 }}>
                      {h.team || '—'}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, color: h.soldPrice ? 'var(--primary)' : 'var(--text-muted)' }}>
                      {h.soldPrice ? formatCurrency(h.soldPrice) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
