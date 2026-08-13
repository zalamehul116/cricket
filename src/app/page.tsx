'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Player, Team } from '@/lib/excel';
import { getDirectDriveUrl, formatCurrency } from '@/lib/utils';
import ImageKitImage from '@/components/ImageKitImage';
import { 
  Users, Trophy, CheckCircle, XCircle, AlertCircle, 
  TrendingUp, Coins, ShieldAlert, Award, Search, RefreshCw,
  Plus, Play, Check, Shield
} from 'lucide-react';

export default function AuctionDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<{ loggedIn: boolean; role?: 'admin' | 'team'; name?: string } | null>(null);
  
  // Data lists
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [auctions, setAuctions] = useState<any[]>([]);
  const [selectedAuctionName, setSelectedAuctionName] = useState<string>('');
  const [activeAuction, setActiveAuction] = useState<any | null>(null);
  
  // Selection/Bidding state
  const [activePlayer, setActivePlayer] = useState<Player | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(50000);
  const [selectedTeamName, setSelectedTeamName] = useState<string>('');
  
  // Filters/Searches
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  
  // UI Loaders & Messages
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [celebrationData, setCelebrationData] = useState<{ player: Player; team: string; price: number } | null>(null);
  
  const activePlayerRef = useRef<Player | null>(null);

  // Admin Auction Creator State
  const [isCreatingAuction, setIsCreatingAuction] = useState<boolean>(false);
  const [newAuctionName, setNewAuctionName] = useState<string>('');
  const [selectedParticipantTeams, setSelectedParticipantTeams] = useState<string[]>([]);

  // Fetch session details on mount
  const checkSession = async () => {
    try {
      const res = await fetch(`/api/auth/session?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setSession(data);
        if (data.loggedIn && data.role === 'team') {
          router.push('/team-dashboard');
        }
      }
    } catch (err) {
      console.error('Error fetching session:', err);
    }
  };

  const fetchData = useCallback(async (auctionFilter?: string) => {
    const auctionName = auctionFilter ?? selectedAuctionName;

    try {
      const playerUrl = auctionName
        ? `/api/players?auctionName=${encodeURIComponent(auctionName)}&t=${Date.now()}`
        : `/api/players?t=${Date.now()}`;
      const teamUrl = auctionName
        ? `/api/teams?auctionName=${encodeURIComponent(auctionName)}&t=${Date.now()}`
        : `/api/teams?t=${Date.now()}`;

      const [resPlayers, resTeams, resAuctions] = await Promise.all([
        fetch(playerUrl, { cache: 'no-store' }),
        fetch(teamUrl, { cache: 'no-store' }),
        fetch(`/api/auction/list?t=${Date.now()}`, { cache: 'no-store' })
      ]);

      const dataPlayers = await resPlayers.json();
      const dataTeams = await resTeams.json();
      const dataAuctions = await resAuctions.json();

      if (dataPlayers.success && dataTeams.success && dataAuctions.success) {
        setPlayers(dataPlayers.data || []);
        setTeams(dataTeams.data || []);
        setAuctions(dataAuctions.auctions || []);

        const auctionList = dataAuctions.auctions || [];
        const selected = auctionName
          ? auctionList.find((a: any) => a.name === auctionName) || null
          : null;

        setActiveAuction(selected || null);

        const prevPlayer = activePlayerRef.current;
        const currentPlayer = selected && selected.activePlayerMobile
          ? dataPlayers.data.find((p: Player) => p.mobile === selected.activePlayerMobile)
          : null;

        // If there was a player on the block previously, and now there isn't:
        if (prevPlayer && !currentPlayer) {
          const updatedPlayer = dataPlayers.data.find((p: Player) => p.mobile === prevPlayer.mobile);
          if (updatedPlayer && updatedPlayer.status === 'Sold') {
            setCelebrationData({
              player: updatedPlayer,
              team: updatedPlayer.team || '',
              price: updatedPlayer.soldPrice || prevPlayer.soldPrice || 50000
            });
          }
        }
        
        activePlayerRef.current = currentPlayer || null;

        // Sync local active bidding state with server database values
        if (selected && selected.activePlayerMobile) {
          setActivePlayer(currentPlayer || null);
          setBidAmount(selected.currentBidPrice);
          setSelectedTeamName(selected.currentBidderTeam || '');
        } else {
          setActivePlayer(null);
          setBidAmount(50000);
          setSelectedTeamName('');
        }
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while loading data.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedAuctionName]);

  // Restore last selected auction from browser storage, then load data
  useEffect(() => {
    const saved = localStorage.getItem('oction-selected-auction');
    if (saved) {
      setSelectedAuctionName(saved);
    }
    checkSession();
  }, []);

  useEffect(() => {
    fetchData(selectedAuctionName);
  }, [fetchData, selectedAuctionName]);

  // Poll for active player and bid price updates every 2 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [fetchData]);

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

  const selectedAuction = auctions.find((a) => a.name === selectedAuctionName);
  const auctionPlayers = selectedAuctionName ? players : [];
  const displayTeams = selectedAuction
    ? teams.filter((t) => selectedAuction.teams.includes(t.name))
    : [];

  // Recalculate team stats dynamically based on auction-scoped players
  const getTeamStats = (teamName: string) => {
    const team = teams.find(t => t.name === teamName);
    const initialBudget = team ? team.budget : 10000000;
    
    const teamPlayers = auctionPlayers.filter(p => p.team === teamName);
    const spent = teamPlayers.reduce((sum, p) => sum + (p.soldPrice ? Number(p.soldPrice) : 0), 0);
    const remaining = initialBudget - spent;
    
    return {
      initialBudget,
      spent,
      remaining,
      playerCount: teamPlayers.length,
      logo: team?.logo || '',
      captain: team?.captain || 'Not Assigned',
      owner: team?.owner || ''
    };
  };

  // Admin puts a player on the block
  const handleStartBidding = async (player: Player) => {
    if (session?.role !== 'admin') return;
    if (!activeAuction) {
      setError('Please select an auction round first.');
      return;
    }

    setIsActionLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const basePrice = player.soldPrice ? Number(player.soldPrice) : 50000;
      const res = await fetch('/api/auction/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activeAuction.name,
          action: 'setPlayer',
          mobile: player.mobile,
          basePrice
        })
      });

      const result = await res.json();
      if (result.success) {
        setSuccess(`${player.name} is now on the bidding block.`);
        await fetchData();
      } else {
        setError(result.error || 'Failed to start bidding.');
      }
    } catch (err) {
      console.error(err);
      setError('Error placing player on block.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Admin manually updates the current bid price
  const handleAdminBidUpdate = async (amountToAdd: number) => {
    if (!activeAuction || !activePlayer || session?.role !== 'admin') return;

    const newBidPrice = activeAuction.currentBidPrice + amountToAdd;

    try {
      const res = await fetch('/api/auction/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activeAuction.name,
          action: 'setPlayer',
          mobile: activePlayer.mobile,
          basePrice: newBidPrice
        })
      });
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Admin overrides and sets the manual bidder team
  const handleAdminSelectBidder = async (teamName: string) => {
    if (!activeAuction || !activePlayer || session?.role !== 'admin') return;

    try {
      // Create a request to set the bidder team on the active player
      const res = await fetch('/api/auction/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activeAuction.name,
          action: 'setPlayer',
          mobile: activePlayer.mobile,
          basePrice: activeAuction.currentBidPrice,
          bidderTeam: teamName
        })
      });

      const data = await res.json();
      if (data.success) {
        // Update local state directly
        setSelectedTeamName(teamName);
      }
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Admin clicks SOLD: finalize player allocation and clear block
  const handleSold = async () => {
    if (!activePlayer || !activeAuction) return;
    const finalTeam = selectedTeamName || activeAuction.currentBidderTeam;

    if (!finalTeam) {
      setError('Please select/specify the winning bidder team.');
      return;
    }

    const teamStats = getTeamStats(finalTeam);
    if (bidAmount > teamStats.remaining) {
      setError(`Cannot buy player! ${finalTeam} only has ${formatCurrency(teamStats.remaining)} remaining budget.`);
      return;
    }

    setIsActionLoading(true);
    setError(null);
    try {
      // 1. Mark player as sold in Excel sheet
      const resPlayer = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerMobile: activePlayer.mobile,
          status: 'Sold',
          team: finalTeam,
          soldPrice: bidAmount,
          auctionName: activeAuction.name
        })
      });

      const resultPlayer = await resPlayer.json();
      if (resultPlayer.success) {
        // 2. Clear player from bidding block
        await fetch('/api/auction/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: activeAuction.name,
            action: 'setPlayer',
            mobile: ''
          })
        });

        setSuccess(`Player ${activePlayer.name} sold to ${finalTeam} for ${formatCurrency(bidAmount)}!`);
        await fetchData();
      } else {
        setError(resultPlayer.error || 'Failed to finalize sale in Excel.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error updating player status.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Admin clicks UNSOLD: mark player as unsold and clear block
  const handleUnsold = async () => {
    if (!activePlayer || !activeAuction) return;

    setIsActionLoading(true);
    setError(null);
    try {
      // 1. Mark player as Unsold in Excel sheet
      const resPlayer = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerMobile: activePlayer.mobile,
          status: 'Unsold',
          team: '',
          soldPrice: '',
          auctionName: activeAuction.name
        })
      });

      const resultPlayer = await resPlayer.json();
      if (resultPlayer.success) {
        // 2. Clear player from bidding block
        await fetch('/api/auction/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: activeAuction.name,
            action: 'setPlayer',
            mobile: ''
          })
        });

        setSuccess(`Player ${activePlayer.name} marked as Unsold.`);
        await fetchData();
      } else {
        setError(resultPlayer.error || 'Failed to update player status.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error updating player status.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Admin clears the block
  const handleCancelBidding = async () => {
    if (!activeAuction) return;
    setIsActionLoading(true);
    try {
      await fetch('/api/auction/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activeAuction.name,
          action: 'setPlayer',
          mobile: ''
        })
      });
      setSuccess('Bidding console cleared.');
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Admin selects which auction round to view / operate on
  const handleSelectAuction = (name: string) => {
    if (!name) {
      setSelectedAuctionName('');
      localStorage.removeItem('oction-selected-auction');
      setActiveAuction(null);
      setActivePlayer(null);
      return;
    }

    setSelectedAuctionName(name);
    localStorage.setItem('oction-selected-auction', name);
  };

  // Admin creates a new auction
  const handleCreateAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuctionName.trim()) return;

    setIsActionLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auction/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAuctionName,
          teams: selectedParticipantTeams
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(data.message);
        setNewAuctionName('');
        setSelectedParticipantTeams([]);
        setIsCreatingAuction(false);
        await fetchData();
      } else {
        setError(data.error || 'Failed to create auction');
      }
    } catch (err) {
      console.error(err);
      setError('Network error creating auction');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleToggleParticipantTeam = (teamName: string) => {
    setSelectedParticipantTeams(prev => 
      prev.includes(teamName) 
        ? prev.filter(t => t !== teamName) 
        : [...prev, teamName]
    );
  };

  // Statistics (scoped to selected auction when one is chosen)
  const totalCount = auctionPlayers.length;
  const soldCount = auctionPlayers.filter(p => p.status === 'Sold' || p.status === 'Captain').length;
  const unsoldCount = auctionPlayers.filter(p => p.status === 'Unsold').length;
  const remainingCount = totalCount - soldCount - unsoldCount;

  // Filtered unsold players in the selected auction pool
  const filteredPlayers = auctionPlayers.filter(p => {
    const isAvailable = p.status === '' || p.status === 'Unsold';
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.mobile.includes(searchQuery);
    const matchesRole = roleFilter === 'All' || p.playingRole === roleFilter;
    return isAvailable && matchesSearch && matchesRole && p.mobile !== activePlayer?.mobile;
  });

  const isAdmin = session?.loggedIn && session?.role === 'admin';

  return (
    <>
      <div className="animate-slide-up">
      {/* Top Banner and Quick Stats */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Live Auction Room
          </h1>
          <p className="page-subtitle">
            {selectedAuctionName
              ? `Viewing auction: ${selectedAuctionName}${selectedAuction?.status === 'Active' ? ' (Live)' : selectedAuction ? ` (${selectedAuction.status})` : ''}`
              : isAdmin
                ? 'Admin Console: Start bidding rounds, record sales, and configure tournaments.'
                : 'Viewer Board: Monitor live bidded players and standings.'}
          </p>
        </div>
        <button 
          onClick={() => fetchData(selectedAuctionName)} 
          className="btn btn-secondary" 
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          disabled={isLoading}
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Selector & Controls Row */}
      <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? 'repeat(auto-fit, minmax(320px, 1fr))' : '1fr', gap: '1.25rem', marginBottom: '2rem' }}>
        {/* Auction selector — visible to all users */}
        <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid rgba(245, 158, 11, 0.15)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '0.5rem', borderRadius: '8px', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trophy size={18} />
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.25rem' }}>Select Auction Round</div>
              <select
                value={selectedAuctionName}
                onChange={(e) => handleSelectAuction(e.target.value)}
                className="form-input admin-select"
                style={{ fontSize: '0.9rem', padding: '0.4rem 0.6rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, width: '100%' }}
              >
                <option value="">-- Select Auction --</option>
                {auctions.map(a => (
                  <option key={a.name} value={a.name}>
                    {a.name} ({a.status}{a.status === 'Active' ? ' • Live' : ''})
                  </option>
                ))}
              </select>
            </div>
          </div>
          {selectedAuctionName && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
              Showing stats, players & teams for <strong style={{ color: 'var(--primary)' }}>{selectedAuctionName}</strong>
            </div>
          )}
        </div>

        {/* Admin Auction Management Section */}
        {isAdmin && (
          <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '0.5rem', borderRadius: '8px', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Shield size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Admin Controls</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedAuctionName ? `Managing: ${selectedAuctionName}` : 'Select an auction to start bidding'}
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => setIsCreatingAuction(!isCreatingAuction)}
                className="btn btn-primary"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}
              >
                <Plus size={14} />
                <span>{isCreatingAuction ? 'Hide Panel' : 'Create Auction'}</span>
              </button>
            </div>

            {isCreatingAuction && (
              <form onSubmit={handleCreateAuction} style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Auction Name *</label>
                  <input 
                    type="text"
                    placeholder="e.g. Deshottar Premier League 2026"
                    className="form-input"
                    value={newAuctionName}
                    onChange={(e) => setNewAuctionName(e.target.value)}
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>Select Participating Teams</label>
                  {teams.length === 0 ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No teams registered yet.</span>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {teams.map(t => {
                        const isSelected = selectedParticipantTeams.includes(t.name);
                        return (
                          <button
                            key={t.name}
                            type="button"
                            onClick={() => handleToggleParticipantTeam(t.name)}
                            className="btn"
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              background: isSelected ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.02)',
                              border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                              color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                              fontWeight: isSelected ? 700 : 400
                            }}
                          >
                            {t.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button 
                  type="submit"
                  disabled={isActionLoading || teams.length === 0 || !newAuctionName.trim()}
                  className="btn btn-primary"
                  style={{ width: 'fit-content', padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                >
                  Create Round
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Auction Rooms Directory */}
      <div className="glass-panel animate-slide-up" style={{ padding: '1.5rem', marginBottom: '2.5rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Trophy size={20} style={{ color: 'var(--primary)' }} /> Available Auction Rooms
        </h2>
        {auctions.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No auction rounds configured yet.</p>
        ) : (
          <div className="card-grid">
            {auctions.map((auc) => {
              const isRoomActive = auc.status === 'Active';
              const isRoomCompleted = auc.status === 'Completed';
              const isSelected = auc.name === selectedAuctionName;
              return (
                <div 
                  key={auc.name} 
                  className="glass-panel" 
                  style={{ 
                    padding: '1.25rem', 
                    display: 'flex', 
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    background: isSelected ? 'rgba(245, 158, 11, 0.08)' : isRoomActive ? 'rgba(245, 158, 11, 0.03)' : 'var(--bg-card)',
                    border: isSelected ? '1px solid rgba(245, 158, 11, 0.5)' : isRoomActive ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-color)',
                    boxShadow: isSelected ? '0 8px 30px rgba(245, 158, 11, 0.1)' : 'none',
                    borderRadius: '16px',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: isSelected ? 'var(--primary)' : 'var(--text-primary)' }}>{auc.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span>Status:</span>
                        <span className={`badge ${isRoomActive ? 'badge-captain' : isRoomCompleted ? 'badge-sold' : 'badge-pending'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', textTransform: 'uppercase', fontWeight: 700 }}>
                          {auc.status}
                        </span>
                      </div>
                    </div>
                    <div style={{ background: isRoomActive ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255,255,255,0.03)', padding: '0.5rem', borderRadius: '10px', color: isRoomActive ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trophy size={16} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Teams:</span> <strong style={{ color: 'var(--text-primary)' }}>{auc.teams ? auc.teams.length : 0}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Limit:</span> <strong style={{ color: 'var(--text-primary)' }}>{auc.playersLimit || 20}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <a 
                      href={`/auctions/${encodeURIComponent(auc.uuid || auc.name)}`}
                      className="btn btn-primary"
                      style={{ flex: 1, textAlign: 'center', padding: '0.45rem', fontSize: '0.75rem', textDecoration: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', borderRadius: '8px' }}
                    >
                      <Play size={10} fill="#fff" />
                      <span>Enter Room</span>
                    </a>
                    <button
                      onClick={() => handleSelectAuction(auc.name)}
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: '0.45rem', fontSize: '0.75rem', borderColor: isSelected ? 'var(--primary)' : 'var(--border-color)', color: isSelected ? 'var(--primary)' : 'var(--text-secondary)', borderRadius: '8px' }}
                    >
                      {isSelected ? 'Selected' : 'View Stats'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats Summary Grid */}
      {!selectedAuctionName ? (
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2.5rem', textAlign: 'center', borderStyle: 'dashed' }}>
          <Trophy size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Select an auction above to view Total Players, Sold, Unsold, Remaining Pool, Unsold Players, and Team Standings.
          </p>
        </div>
      ) : (
      <div className="stats-grid" style={{ marginBottom: '2.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '12px', color: 'var(--text-primary)' }}>
            <Users size={28} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Total Players</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{totalCount}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '12px', color: 'var(--success)' }}>
            <Trophy size={28} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Players Sold</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success)' }}>{soldCount}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '12px', color: 'var(--danger)' }}>
            <XCircle size={28} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Players Unsold</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--danger)' }}>{unsoldCount}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '0.75rem', borderRadius: '12px', color: 'var(--info)' }}>
            <TrendingUp size={28} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Remaining Pool</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--info)' }}>{remainingCount}</div>
          </div>
        </div>
      </div>
      )}

      {/* Notifications */}
      {error && (
        <div className="glass-panel" style={{ padding: '1rem 1.5rem', borderColor: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <AlertCircle style={{ color: 'var(--danger)' }} />
          <span style={{ color: 'var(--danger)', fontWeight: 500 }}>{error}</span>
        </div>
      )}
      {success && (
        <div className="glass-panel" style={{ padding: '1rem 1.5rem', borderColor: 'var(--success)', background: 'rgba(16, 185, 129, 0.05)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <CheckCircle style={{ color: 'var(--success)' }} />
          <span style={{ color: 'var(--success)', fontWeight: 500 }}>{success}</span>
        </div>
      )}

      {/* Main Grid */}
      {!selectedAuctionName ? (
        <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center', borderStyle: 'dashed' }}>
          <Users size={40} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Auction Selected</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Choose an auction round from the dropdown to see the live console, unsold players, and team standings.
          </p>
        </div>
      ) : (
      <div className="responsive-grid-3col">
        {/* Bidding Area */}
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Coins style={{ color: 'var(--primary)' }} /> Live Console
          </h2>
          {activePlayer ? (
            <div className="glass-panel glass-panel-glow pulse-glow-border" style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {timeLeft !== null && (
                  <div 
                    style={{ 
                      fontSize: '0.9rem', 
                      fontWeight: 800, 
                      padding: '0.2rem 0.6rem', 
                      borderRadius: '6px', 
                      background: timeLeft <= 5 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0,0,0,0.3)',
                      color: timeLeft <= 5 ? 'var(--danger)' : 'var(--warning)',
                      border: timeLeft <= 5 ? '1px solid var(--danger)' : '1px solid var(--border-color)',
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
                <span className="badge badge-pending">Active Bid</span>
              </div>
              
              <div className="active-player-header">
                <div style={{ width: '130px', height: '130px', borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--primary)', boxShadow: '0 0 15px rgba(245, 158, 11, 0.3)', flexShrink: 0 }}>
                  <ImageKitImage 
                    src={getDirectDriveUrl(activePlayer.playerPhoto)} 
                    alt={activePlayer.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=300';
                    }}
                  />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.25rem' }}>{activePlayer.name}</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                      {activePlayer.playingRole}
                    </span>
                    <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                      {activePlayer.playingAs}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.75rem' }}>
                    Mob: {activePlayer.mobile}
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Bid Amount</div>
                <div className="bid-amount">
                  {formatCurrency(bidAmount)}
                </div>
                
                {/* Admin Quick Bid Increments */}
                {isAdmin && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                    <button onClick={() => handleAdminBidUpdate(50000)} className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>+50k</button>
                    <button onClick={() => handleAdminBidUpdate(100000)} className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>+1L</button>
                    <button onClick={() => handleAdminBidUpdate(500000)} className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>+5L</button>
                  </div>
                )}
              </div>

              {/* Bid Allocation / Highest Bidder Form */}
              <div style={{ marginBottom: '2rem' }}>
                <label className="form-label">Highest Bidder Team</label>
                {isAdmin ? (
                  <select 
                    className="form-input" 
                    value={selectedTeamName}
                    onChange={(e) => handleAdminSelectBidder(e.target.value)}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="">Select Bidding Team...</option>
                    {displayTeams.map(t => {
                      const stats = getTeamStats(t.name);
                      return (
                        <option key={t.name} value={t.name}>
                          {t.name} (Max: {formatCurrency(stats.remaining)})
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div style={{ padding: '0.65rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid var(--border-color)', fontWeight: 700, color: 'var(--primary)' }}>
                    {selectedTeamName || 'No Bid Placed'}
                  </div>
                )}
                
                {selectedTeamName && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Budget Limit:</span>
                    <span style={{ fontWeight: 600, color: getTeamStats(selectedTeamName).remaining >= bidAmount ? 'var(--success)' : 'var(--danger)' }}>
                      {formatCurrency(getTeamStats(selectedTeamName).remaining)}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              {isAdmin ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <button 
                      onClick={handleSold} 
                      disabled={isActionLoading || !selectedTeamName} 
                      className={`btn btn-success ${isActionLoading || !selectedTeamName ? 'btn-disabled' : ''}`}
                    >
                      SOLD
                    </button>
                    <button 
                      onClick={handleUnsold} 
                      disabled={isActionLoading} 
                      className={`btn btn-danger ${isActionLoading ? 'btn-disabled' : ''}`}
                    >
                      UNSOLD
                    </button>
                  </div>

                  <button 
                    onClick={handleCancelBidding} 
                    className="btn btn-secondary" 
                    style={{ width: '100%', marginTop: '1rem', border: '1px dashed var(--border-color)' }}
                  >
                    Cancel Bidding
                  </button>
                </>
              ) : (
                <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--info)', fontWeight: 600 }}>
                  💡 Bidding is live! Refresh or wait for updates.
                </div>
              )}
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', borderStyle: 'dashed' }}>
              <div style={{ width: '70px', height: '70px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <Trophy size={36} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>No Active Player</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '300px', margin: '0 auto' }}>
                {isAdmin ? 'Search and select a player from the list on the right to start live bidding.' : 'Waiting for the administrator to put the first player on the block.'}
              </p>
            </div>
          )}
        </div>

        {/* Players List */}
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users style={{ color: 'var(--secondary)' }} /> Unsold Players ({filteredPlayers.length}{selectedAuctionName ? ` · ${selectedAuctionName}` : ''})
          </h2>
          <div className="glass-panel" style={{ padding: '1.25rem', maxHeight: '550px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Filters */}
            <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column', marginBottom: '0.5rem' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Search player name..." 
                  className="form-input" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '2.25rem', fontSize: '0.85rem' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                {['All', 'Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper'].map((role) => (
                  <button
                    key={role}
                    onClick={() => setRoleFilter(role)}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      borderRadius: '4px',
                      background: roleFilter === role ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                      color: roleFilter === role ? '#000' : 'var(--text-secondary)',
                      fontWeight: 600
                    }}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading players...</div>
            ) : filteredPlayers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No unsold players found matching current search/filter criteria.
              </div>
            ) : (
              filteredPlayers.map((player, idx) => (
                <div 
                  key={`${player.mobile}-${idx}`}
                  onClick={() => isAdmin && handleStartBidding(player)}
                  className="glass-panel"
                  style={{ 
                    padding: '0.75rem 1rem', 
                    cursor: isAdmin ? 'pointer' : 'default', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    gap: '1rem',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    pointerEvents: isAdmin ? 'auto' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                      <ImageKitImage 
                        src={getDirectDriveUrl(player.playerPhoto)} 
                        alt={player.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100';
                        }}
                      />
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {player.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {player.playingRole}
                      </div>
                    </div>
                  </div>
                  {isAdmin && (
                    <button className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', flexShrink: 0 }}>
                      Bid
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Team Budgets Board */}
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award style={{ color: 'var(--primary)' }} /> Team Standings{selectedAuctionName ? ` · ${selectedAuctionName}` : ''}
          </h2>
          <div className="glass-panel" style={{ padding: '1.25rem', maxHeight: '550px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading teams...</div>
            ) : displayTeams.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {selectedAuctionName ? 'No teams assigned to this auction yet.' : 'No teams registered yet.'}
              </div>
            ) : (
              displayTeams.map((t) => {
                const stats = getTeamStats(t.name);
                return (
                  <div 
                    key={t.name}
                    className="glass-panel"
                    style={{ 
                      padding: '1rem', 
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem'
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {stats.logo ? (
                          <div style={{ width: '32px', height: '32px', borderRadius: '6px', overflow: 'hidden' }}>
                            <ImageKitImage 
                              src={getDirectDriveUrl(stats.logo)} 
                              alt={t.name} 
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100';
                              }}
                            />
                          </div>
                        ) : (
                          <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.85rem' }}>
                            {t.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Owner: {t.owner || 'N/A'}</div>
                        </div>
                      </div>
                      <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)', fontSize: '0.7rem' }}>
                        {stats.playerCount} Players
                      </span>
                    </div>

                    {/* Stats Line */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: 'rgba(0,0,0,0.15)', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Spent</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(stats.spent)}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Remaining</div>
                        <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(stats.remaining)}</div>
                      </div>
                    </div>

                    {/* Captain */}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <ShieldAlert size={12} style={{ color: 'var(--primary)' }} />
                      <span>Captain: <strong style={{ color: 'var(--text-primary)' }}>{stats.captain}</strong></span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      )}

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
              Continue Draft
            </button>
          </div>
        </div>
      )}
    </>
  );
}
