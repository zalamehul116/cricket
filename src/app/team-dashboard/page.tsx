'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, Shield, Users, BadgeDollarSign, Play, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { formatCurrency, getDirectDriveUrl } from '@/lib/utils';
import ImageKitImage from '@/components/ImageKitImage';

export default function TeamDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<{ loggedIn: boolean; role?: 'admin' | 'team'; name?: string } | null>(null);
  const [activeAuction, setActiveAuction] = useState<any | null>(null);
  const [auctions, setAuctions] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  
  const [activePlayer, setActivePlayer] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBidding, setIsBidding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [celebrationData, setCelebrationData] = useState<{ player: any; team: string; price: number } | null>(null);

  const activePlayerRef = useRef<any | null>(null);

  // Authenticate session
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`/api/auth/session?t=${Date.now()}`, { cache: 'no-store' });
        const data = await res.json();
        if (!data.loggedIn || data.role !== 'team') {
          router.push('/login');
        } else {
          setSession(data);
        }
      } catch (err) {
        console.error('Session verification failed:', err);
        router.push('/login');
      }
    };
    checkAuth();
  }, [router]);

  const fetchData = useCallback(async () => {
    if (!session?.name) return;
    try {
      const [resAuctions, resTeams] = await Promise.all([
        fetch(`/api/auction/list?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/teams?t=${Date.now()}`, { cache: 'no-store' })
      ]);
      
      const dataAuctions = await resAuctions.json();
      const dataTeams = await resTeams.json();

      if (dataAuctions.success && dataTeams.success) {
        const active = dataAuctions.auctions.find((a: any) => a.status === 'Active');
        const activeAuctionName = active ? active.name : '';

        // Fetch players scoped by active auction
        const resPlayers = await fetch(`/api/players?auctionName=${encodeURIComponent(activeAuctionName)}&t=${Date.now()}`, { cache: 'no-store' });
        const dataPlayers = await resPlayers.json();

        if (dataPlayers.success) {
          setActiveAuction(active || null);
          setAuctions(dataAuctions.auctions || []);
          setPlayers(dataPlayers.data || []);
          setTeams(dataTeams.data || []);

          const prevPlayer = activePlayerRef.current;
          const currentPlayer = active && active.activePlayerMobile
            ? dataPlayers.data.find((p: any) => p.mobile === active.activePlayerMobile)
            : null;

          // If there was a player on the block previously, and now there isn't:
          if (prevPlayer && !currentPlayer) {
            const updatedPlayer = dataPlayers.data.find((p: any) => p.mobile === prevPlayer.mobile);
            if (updatedPlayer && updatedPlayer.status === 'Sold') {
              setCelebrationData({
                player: updatedPlayer,
                team: updatedPlayer.team || '',
                price: updatedPlayer.soldPrice || prevPlayer.soldPrice || 50000
              });
            }
          }

          activePlayerRef.current = currentPlayer || null;

          if (active && active.activePlayerMobile) {
            setActivePlayer(currentPlayer || null);
          } else {
            setActivePlayer(null);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  // Initial fetch and polling every 2 seconds
  useEffect(() => {
    if (session?.name) {
      fetchData();
      const interval = setInterval(fetchData, 2000);
      return () => clearInterval(interval);
    }
  }, [session, fetchData]);

  // Synchronized countdown timer hook
  useEffect(() => {
    if (!activeAuction || !activeAuction.timerEndsAt || !activePlayer) {
      setTimeLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const endTime = new Date(activeAuction.timerEndsAt).getTime();
      const now = Date.now();
      const diff = Math.ceil((endTime - now) / 1000);

      if (diff <= 0) {
        setTimeLeft(0);
        clearInterval(interval);
      } else {
        setTimeLeft(diff);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [activeAuction?.timerEndsAt, activePlayer?.mobile]);

  // Celebration auto-dismiss hook
  useEffect(() => {
    if (celebrationData) {
      const timer = setTimeout(() => {
        setCelebrationData(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [celebrationData]);

  const handlePlaceBid = async (amountToAdd: number) => {
    if (!activeAuction || !activePlayer || !session) return;

    setIsBidding(true);
    setError(null);
    setSuccess(null);

    const bidPrice = activeAuction.currentBidPrice + amountToAdd;

    try {
      const res = await fetch('/api/auction/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidPrice })
      });
      const data = await res.json();

      if (data.success) {
        setSuccess(`You placed a bid of ${formatCurrency(bidPrice)}!`);
        fetchData();
      } else {
        setError(data.error || 'Failed to place bid');
      }
    } catch (err) {
      console.error(err);
      setError('Network error placing bid');
    } finally {
      setIsBidding(false);
    }
  };

  if (isLoading || !session) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
        <RefreshCw size={36} className="animate-spin" style={{ color: 'var(--info)' }} />
        <span style={{ color: 'var(--text-secondary)' }}>Loading Dashboard...</span>
      </div>
    );
  }

  // Get active team details
  const myTeam = teams.find(t => t.name === session.name);
  const myPlayers = players.filter(p => p.team === session.name && p.status !== 'Unsold');
  const totalSpent = myPlayers.reduce((sum, p) => sum + (p.soldPrice ? Number(p.soldPrice) : 0), 0);
  const initialBudget = myTeam ? myTeam.budget : 10000000;
  const remainingBudget = initialBudget - totalSpent;

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Dashboard Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title-cyan">
            <Shield style={{ color: 'var(--info)' }} /> {session.name}
          </h1>
          <p className="page-subtitle">
            Live Bidding Room & Squad Manager
          </p>
        </div>
        
        <button 
          onClick={fetchData} 
          className="btn btn-secondary" 
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <RefreshCw size={16} />
          <span>Sync Status</span>
        </button>
      </div>

      {/* Available Auction Rooms Section */}
      <div className="glass-panel animate-slide-up" style={{ padding: '1.5rem', border: '1px solid rgba(6, 182, 212, 0.15)' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Trophy size={18} style={{ color: 'var(--info)' }} /> Available Auction Rooms
        </h2>
        {auctions.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No auction rounds configured yet.</p>
        ) : (
          <div className="card-grid">
            {auctions.map((auc) => {
              const isRoomActive = auc.status === 'Active';
              const isRoomCompleted = auc.status === 'Completed';
              return (
                <div 
                  key={auc.name} 
                  className="glass-panel" 
                  style={{ 
                    padding: '1rem', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    background: isRoomActive ? 'rgba(6, 182, 212, 0.03)' : 'rgba(255,255,255,0.01)',
                    border: isRoomActive ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid var(--border-color)'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{auc.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      Status: <span style={{ color: isRoomActive ? 'var(--info)' : isRoomCompleted ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600 }}>{auc.status}</span>
                    </div>
                  </div>
                  <a 
                    href={`/auctions/${encodeURIComponent(auc.uuid || auc.name)}`}
                    className="btn btn-primary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', textDecoration: 'none', color: '#fff', backgroundColor: 'var(--info)', borderColor: 'var(--info)' }}
                  >
                    Enter Room
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="glass-panel" style={{ padding: '1rem 1.5rem', borderColor: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertCircle style={{ color: 'var(--danger)' }} />
          <span style={{ color: 'var(--danger)', fontWeight: 500 }}>{error}</span>
        </div>
      )}
      {success && (
        <div className="glass-panel" style={{ padding: '1rem 1.5rem', borderColor: 'var(--success)', background: 'rgba(16, 185, 129, 0.05)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CheckCircle style={{ color: 'var(--success)' }} />
          <span style={{ color: 'var(--success)', fontWeight: 500 }}>{success}</span>
        </div>
      )}

      {/* Financial Counters Card Grid */}
      <div className="stats-grid">
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '0.75rem', borderRadius: '12px', color: 'var(--info)' }}>
            <BadgeDollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Total Budget</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{formatCurrency(initialBudget)}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '12px', color: 'var(--success)' }}>
            <BadgeDollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Remaining Budget</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>{formatCurrency(remainingBudget)}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '12px', color: 'var(--danger)' }}>
            <BadgeDollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Spent Budget</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger)' }}>{formatCurrency(totalSpent)}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '0.75rem', borderRadius: '12px', color: 'var(--text-secondary)' }}>
            <Users size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Players Drafted</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{myPlayers.length}</div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-grid">
        
        {/* Left Column: Live Bidding Block */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', minHeight: '400px', justifyContent: 'center' }}>
            {!activeAuction ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <Trophy size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Active Auction</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  There is no active auction running currently. The administrator will activate an auction round soon.
                </p>
              </div>
            ) : !activePlayer ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <Play size={48} style={{ color: 'var(--info)', marginBottom: '1rem', animation: 'pulse 2s infinite' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--info)' }}>Bidding Round Paused</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Active Auction: <strong>{activeAuction.name}</strong>
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  Waiting for the administrator to put the next player on the block...
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Active Round Info Header */}
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--info)', fontWeight: 700 }}>Active Player on Block</span>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>{activePlayer.name}</h2>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {timeLeft !== null && (
                      <div 
                        style={{ 
                          fontSize: '0.9rem', 
                          fontWeight: 800, 
                          padding: '0.3rem 0.75rem', 
                          borderRadius: '20px', 
                          background: timeLeft <= 5 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(6, 182, 212, 0.1)',
                          color: timeLeft <= 5 ? 'var(--danger)' : 'var(--info)',
                          border: timeLeft <= 5 ? '1px solid var(--danger)' : '1px solid rgba(6, 182, 212, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          animation: timeLeft <= 5 ? 'pulse 0.5s infinite alternate' : 'none'
                        }}
                      >
                        <span>⏱️</span>
                        <span>{timeLeft > 0 ? `${timeLeft}s` : 'Time Out'}</span>
                      </div>
                    )}
                    <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem', color: 'var(--info)', fontWeight: 600 }}>
                      {activePlayer.playingRole}
                    </div>
                  </div>
                </div>

                {/* Player details content block */}
                <div className="settings-grid">
                  {/* Photo */}
                  <div style={{ width: '150px', height: '150px', borderRadius: '12px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                    <ImageKitImage 
                      src={getDirectDriveUrl(activePlayer.playerPhoto)} 
                      alt={activePlayer.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=300';
                      }}
                    />
                  </div>

                  {/* Bidding Stats */}
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Base Price</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                          {activePlayer.soldPrice ? formatCurrency(activePlayer.soldPrice) : '₹50,000'}
                        </div>
                      </div>

                      <div style={{ background: 'rgba(6, 182, 212, 0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.15)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--info)', fontWeight: 600 }}>Current Bid</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--info)' }}>
                          {formatCurrency(activeAuction.currentBidPrice)}
                        </div>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.15)', padding: '0.75rem 1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Highest Bidder:</span>
                      <span style={{ 
                        fontWeight: 700, 
                        color: (activeAuction.currentBidderTeam || '').toLowerCase() === (session?.name || '').toLowerCase() ? 'var(--success)' : 'var(--text-primary)',
                        fontSize: '0.95rem'
                      }}>
                        {activeAuction.currentBidderTeam ? (
                          (activeAuction.currentBidderTeam || '').toLowerCase() === (session?.name || '').toLowerCase() 
                            ? '🎉 You hold the bid!' 
                            : activeAuction.currentBidderTeam
                        ) : (
                          'No bids placed yet'
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bidding Action Console */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Place Bid Increment:</div>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handlePlaceBid(50000)}
                      disabled={isBidding || timeLeft === 0 || (activeAuction.currentBidderTeam || '').toLowerCase() === (session?.name || '').toLowerCase() || (activeAuction.currentBidPrice + 50000) > remainingBudget}
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: '0.75rem', fontSize: '0.85rem', border: '1px solid var(--info)', color: 'var(--info)' }}
                    >
                      +50,000 INR
                    </button>
                    <button
                      onClick={() => handlePlaceBid(100000)}
                      disabled={isBidding || timeLeft === 0 || (activeAuction.currentBidderTeam || '').toLowerCase() === (session?.name || '').toLowerCase() || (activeAuction.currentBidPrice + 100000) > remainingBudget}
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: '0.75rem', fontSize: '0.85rem', border: '1px solid var(--info)', color: 'var(--info)' }}
                    >
                      +100,000 INR
                    </button>
                    <button
                      onClick={() => handlePlaceBid(500000)}
                      disabled={isBidding || timeLeft === 0 || (activeAuction.currentBidderTeam || '').toLowerCase() === (session?.name || '').toLowerCase() || (activeAuction.currentBidPrice + 500000) > remainingBudget}
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: '0.75rem', fontSize: '0.85rem', border: '1px solid var(--info)', color: 'var(--info)' }}
                    >
                      +500,000 INR
                    </button>
                  </div>
                  
                  {timeLeft === 0 && (
                    <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--danger)', fontWeight: 700, marginTop: '0.5rem', animation: 'pulse 1s infinite' }}>
                      ⏱ Bidding has timed out! Waiting for administrator action.
                    </div>
                  )}

                  {(activeAuction.currentBidderTeam || '').toLowerCase() === (session?.name || '').toLowerCase() && timeLeft !== 0 && (
                    <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600, marginTop: '0.5rem' }}>
                      ✓ Your team holds the highest bid. Waiting for other teams or the administrator to finalize.
                    </div>
                  )}

                  {remainingBudget < (activeAuction.currentBidPrice + 50000) && (
                    <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--danger)', fontWeight: 600, marginTop: '0.5rem' }}>
                      ⚠ Insufficient budget to place a higher bid!
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Team Roster / Squad Breakdown */}
        <div>
          <div className="glass-panel" style={{ padding: '1.75rem', maxHeight: '550px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={18} /> My Squad ({myPlayers.length} Players)
            </h3>
            
            {myPlayers.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-color)', borderRadius: '8px', padding: '2rem', textAlign: 'center' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No players drafted yet. Place bids during the auction to build your squad!
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', flex: 1, paddingRight: '0.25rem' }}>
                {myPlayers.map((p, idx) => (
                  <div 
                    key={`${p.mobile}-${idx}`} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '0.6rem 0.8rem', 
                      background: 'rgba(255,255,255,0.03)', 
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '8px',
                      fontSize: '0.85rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden' }}>
                        <ImageKitImage 
                          src={getDirectDriveUrl(p.playerPhoto)} 
                          alt={p.name} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100';
                          }}
                        />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{p.playingRole}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <div style={{ fontWeight: 700, color: 'var(--info)' }}>
                        {p.soldPrice ? formatCurrency(p.soldPrice) : '₹0'}
                      </div>
                      {p.status === 'Captain' && (
                        <span style={{ fontSize: '0.65rem', background: 'rgba(245,158,11,0.15)', color: 'var(--primary)', padding: '0.1rem 0.3rem', borderRadius: '4px', marginTop: '0.15rem', fontWeight: 600 }}>
                          Captain
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {celebrationData && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'center',
            overflowY: 'auto',
            padding: '2rem 1rem',
            backdropFilter: 'blur(10px)',
            animation: 'fadeIn 0.5s ease-out forwards'
          }}
        >
          {/* Dynamic Styles for Celebration animations */}
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes scaleUp {
              from { transform: scale(0.3) rotate(-5deg); opacity: 0; }
              to { transform: scale(1) rotate(0deg); opacity: 1; }
            }
            @keyframes bounceIn {
              0% { transform: scale(0.3); opacity: 0; }
              50% { transform: scale(1.05); }
              70% { transform: scale(0.9); }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes slideInUp {
              from { transform: translateY(100px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            @keyframes confettiRain {
              0% { transform: translateY(-100%) rotate(0deg); opacity: 1; }
              100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
            }
            @keyframes shimmerGlow {
              0% { box-shadow: 0 0 20px rgba(245, 158, 11, 0.5); }
              50% { box-shadow: 0 0 60px rgba(245, 158, 11, 0.9); }
              100% { box-shadow: 0 0 20px rgba(245, 158, 11, 0.5); }
            }
            .celebration-confetti {
              position: absolute;
              width: 10px;
              height: 10px;
              background-color: #f59e0b;
              border-radius: 50%;
              animation: confettiRain 4s linear infinite;
            }
            .celebration-card {
              background: radial-gradient(circle at top, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.98) 100%);
              border: 4px solid #f59e0b;
              border-radius: 24px;
              padding: 3rem;
              width: 450px;
              max-width: 90%;
              text-align: center;
              position: relative;
              animation: scaleUp 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, shimmerGlow 3s infinite;
              overflow: hidden;
              margin: auto;
            }
            .celebration-banner {
              font-family: var(--font-title);
              font-size: 3.5rem;
              font-weight: 900;
              background: linear-gradient(to right, #f59e0b, #fbbf24, #f59e0b);
              WebkitBackgroundClip: text;
              WebkitTextFillColor: transparent;
              margin-bottom: 1.5rem;
              animation: bounceIn 1s ease-out;
              letter-spacing: 0.1em;
            }
          `}</style>

          {/* Render random confetti drops */}
          {Array.from({ length: 80 }).map((_, i) => {
            const colors = ['#f59e0b', '#fbbf24', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            const randomLeft = Math.random() * 100;
            const randomDelay = Math.random() * 4;
            const randomDuration = 3 + Math.random() * 3;
            const randomSize = 6 + Math.random() * 10;
            
            return (
              <div 
                key={i}
                className="celebration-confetti"
                style={{
                  left: `${randomLeft}%`,
                  backgroundColor: randomColor,
                  animationDelay: `${randomDelay}s`,
                  animationDuration: `${randomDuration}s`,
                  width: `${randomSize}px`,
                  height: `${randomSize}px`,
                  clipPath: Math.random() > 0.5 ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : 'none'
                }}
              />
            );
          })}

          <div className="celebration-card">
            <div className="celebration-banner">SOLD!</div>
            
            {/* Player Photo */}
            <div 
              style={{
                width: '200px',
                height: '200px',
                borderRadius: '50%',
                margin: '0 auto 2rem',
                border: '5px solid #f59e0b',
                overflow: 'hidden',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
              }}
            >
              <ImageKitImage 
                src={getDirectDriveUrl(celebrationData.player.playerPhoto)} 
                alt={celebrationData.player.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                 onError={(e) => {
                   (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=300';
                 }}
              />
            </div>

            {/* Player Name */}
            <h2 className="celebration-name">
              {celebrationData.player.name}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {celebrationData.player.playingRole}
            </p>

            {/* Buyer info block */}
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '1.5rem', borderRadius: '16px', marginBottom: '2.5rem' }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
                Acquired By
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff', marginBottom: '0.5rem' }}>
                {celebrationData.team}
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#f59e0b' }}>
                {formatCurrency(celebrationData.price)}
              </div>
            </div>

            {/* Dismiss Button */}
            <button 
              onClick={() => setCelebrationData(null)}
              className="btn btn-primary"
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: 700 }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
