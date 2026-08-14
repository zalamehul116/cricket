'use client';

import { useState, useEffect, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { Player, Team } from '@/lib/excel';
import { getDirectDriveUrl, formatCurrency } from '@/lib/utils';
import ImageKitImage from '@/components/ImageKitImage';
import {
  Users, Trophy, CheckCircle, XCircle, AlertCircle,
  TrendingUp, Coins, ShieldAlert, Award, Search, RefreshCw,
  Plus, Play, Pause, Check, Shield, Lock, AwardIcon, Sparkles
} from 'lucide-react';

export default function AuctionRoomPage({ params }: { params: Promise<{ uuid: string }> }) {
  const resolvedParams = use(params);
  const auctionUuid = decodeURIComponent(resolvedParams.uuid);
  const router = useRouter();

  const [session, setSession] = useState<{ loggedIn: boolean; role?: 'admin' | 'team'; name?: string } | null>(null);

  // Data lists
  const [players, setPlayers] = useState<Player[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [auctions, setAuctions] = useState<any[]>([]);
  const [activeAuction, setActiveAuction] = useState<any | null>(null);

  // Computed auctionRoomName
  const auctionRoomName = activeAuction?.name || auctionUuid;

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
  const [isBidding, setIsBidding] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [celebrationData, setCelebrationData] = useState<{ player: Player; team: string; price: number } | null>(null);

  // Player Management State
  const [isManagingPlayers, setIsManagingPlayers] = useState<boolean>(false);
  const [assignedSearch, setAssignedSearch] = useState<string>('');
  const [availableSearch, setAvailableSearch] = useState<string>('');

  const activePlayerRef = useRef<Player | null>(null);

  // Authenticate session (no automatic redirects to keep users on this dynamic URL)
  const checkSession = async () => {
    try {
      const res = await fetch(`/api/auth/session?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setSession(data);
      }
    } catch (err) {
      console.error('Error fetching session:', err);
    }
  };

  // Fetch players, teams and auctions
  const fetchData = useCallback(async () => {
    try {
      const [resPlayers, resAvailable, resTeams, resAuctions] = await Promise.all([
        fetch(`/api/players?auctionName=${encodeURIComponent(auctionUuid)}&t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/players?auctionName=${encodeURIComponent(auctionUuid)}&pool=available&t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/teams?auctionName=${encodeURIComponent(auctionUuid)}&t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/auction/list?t=${Date.now()}`, { cache: 'no-store' })
      ]);

      const dataPlayers = await resPlayers.json();
      const dataAvailable = await resAvailable.json();
      const dataTeams = await resTeams.json();
      const dataAuctions = await resAuctions.json();

      if (dataPlayers.success && dataAvailable.success && dataTeams.success && dataAuctions.success) {
        setPlayers(dataPlayers.data || []);
        setAvailablePlayers(dataAvailable.data || []);
        setTeams(dataTeams.data || []);
        setAuctions(dataAuctions.auctions || []);

        // Scope to this specific dynamic auction room name or uuid
        const roomAuction = dataAuctions.auctions.find(
          (a: any) => a.uuid === auctionUuid || a.name.toLowerCase() === auctionUuid.toLowerCase()
        );
        setActiveAuction(roomAuction || null);

        const prevPlayer = activePlayerRef.current;
        const currentPlayer = roomAuction && roomAuction.activePlayerMobile
          ? dataPlayers.data.find((p: Player) => p.mobile === roomAuction.activePlayerMobile)
          : null;

        // Bidding state celebration
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

        if (roomAuction && roomAuction.activePlayerMobile) {
          setActivePlayer(currentPlayer || null);
          setBidAmount(roomAuction.currentBidPrice);
          setSelectedTeamName(roomAuction.currentBidderTeam || '');
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
  }, [auctionUuid]);

  useEffect(() => {
    checkSession();
    fetchData();
  }, [fetchData]);

  // Poll database updates every 2 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Synchronized countdown timer hook
  useEffect(() => {
    if (!activeAuction || !activePlayer) {
      setTimeLeft(null);
      return;
    }

    if (activeAuction.isPaused) {
      setTimeLeft(activeAuction.pausedTimeRemaining !== null && activeAuction.pausedTimeRemaining !== undefined ? activeAuction.pausedTimeRemaining : 120);
      return;
    }

    if (!activeAuction.timerEndsAt) {
      setTimeLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const endTime = new Date(activeAuction.timerEndsAt!).getTime();
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
  }, [activeAuction?.timerEndsAt, activeAuction?.isPaused, activeAuction?.pausedTimeRemaining, activePlayer?.mobile]);

  // Celebration auto-dismiss
  useEffect(() => {
    if (celebrationData) {
      const timer = setTimeout(() => {
        setCelebrationData(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [celebrationData]);

  // Recalculate team stats dynamically (specifically for players assigned to this auction room)
  const getTeamStats = (teamName: string) => {
    const team = teams.find(t => t.name === teamName);
    const initialBudget = team ? team.budget : 10000000;

    const teamPlayers = players.filter(p => p.team === teamName && p.auctionName === auctionRoomName);
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

  // Team placing bid from within this room
  const handlePlaceBid = async (increment: number) => {
    if (!activeAuction || !activePlayer || !session?.name || session.role !== 'team') return;

    setIsBidding(true);
    setError(null);
    setSuccess(null);

    const newBid = activeAuction.currentBidPrice + increment;

    try {
      const res = await fetch('/api/auction/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bidPrice: newBid,
          auctionName: activeAuction.name
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('Bid placed successfully!');
        await fetchData();
      } else {
        setError(data.error || 'Failed to place bid');
      }
    } catch (err) {
      console.error(err);
      setError('Network error placing bid.');
    } finally {
      setIsBidding(false);
    }
  };

  // Admin puts a player on the block
  const handleStartBidding = async (player: Player) => {
    if (session?.role !== 'admin' || !activeAuction) return;

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
      await fetch('/api/auction/list', {
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
        setSelectedTeamName(teamName);
      }
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Admin clicks SOLD
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
      const resPlayer = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerMobile: activePlayer.mobile,
          status: 'Sold',
          team: finalTeam,
          soldPrice: bidAmount,
          auctionName: auctionRoomName
        })
      });

      const resultPlayer = await resPlayer.json();
      if (resultPlayer.success) {
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
        setError(resultPlayer.error || 'Failed to finalize sale.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error updating player status.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Admin clicks UNSOLD
  const handleUnsold = async () => {
    if (!activePlayer || !activeAuction) return;

    setIsActionLoading(true);
    setError(null);
    try {
      const resPlayer = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerMobile: activePlayer.mobile,
          status: 'Unsold',
          team: '',
          soldPrice: '',
          auctionName: auctionRoomName
        })
      });

      const resultPlayer = await resPlayer.json();
      if (resultPlayer.success) {
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

  // Admin clears block
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

  // Admin clicks Pause/Resume Bidding
  const handleTogglePause = async () => {
    if (!activeAuction) return;
    setIsActionLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auction/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activeAuction.name,
          action: activeAuction.isPaused ? 'resume' : 'pause'
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(activeAuction.isPaused ? 'Auction resumed!' : 'Auction paused!');
        await fetchData();
      } else {
        setError(data.error || 'Failed to toggle pause status.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error toggling pause status.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Admin toggles active/complete status from this room page
  const handleAuctionStatusAction = async (action: 'activate' | 'complete') => {
    if (!activeAuction) return;
    setIsActionLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auction/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: activeAuction.name, action })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message);
        await fetchData();
      } else {
        setError(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResetBid = async () => {
    if (!activeAuction || !activePlayer || session?.role !== 'admin') return;
    setIsActionLoading(true);
    try {
      const basePrice = activePlayer.soldPrice ? Number(activePlayer.soldPrice) : 50000;
      const res = await fetch('/api/auction/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activeAuction.name,
          action: 'resetBid',
          basePrice
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Bid reset successfully.');
        await fetchData();
      } else {
        setError(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Add player to this specific auction
  const handleAddPlayerToAuction = async (mobile: string) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerMobile: mobile,
          auctionName: auctionRoomName
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Player added to this auction pool.');
        await fetchData();
      } else {
        setError(data.error);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to add player to auction.');
    }
  };

  // Remove player from this specific auction (resets their auctionName)
  const handleRemovePlayerFromAuction = async (mobile: string) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerMobile: mobile,
          auctionName: ''
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Player removed from this auction pool.');
        await fetchData();
      } else {
        setError(data.error);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to remove player from auction.');
    }
  };

  // Statistics calculations (specifically scoped to this auction's assigned players)
  const auctionPlayers = players;
  const totalCount = auctionPlayers.length;
  const soldCount = auctionPlayers.filter(p => p.status === 'Sold' || p.status === 'Captain').length;
  const unsoldCount = auctionPlayers.filter(p => p.status === 'Unsold').length;
  const remainingCount = totalCount - soldCount - unsoldCount;

  // Filtered unsold players list (specifically participating in this auction room)
  const filteredPlayers = players.filter(p => {
    const isAvailable = p.status === '' || p.status === 'Unsold';
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.mobile.includes(searchQuery);
    const matchesRole = roleFilter === 'All' || p.playingRole === roleFilter;
    return isAvailable && matchesSearch && matchesRole && p.mobile !== activePlayer?.mobile;
  });

  const isAdmin = session?.loggedIn && session?.role === 'admin';
  const myTeamStats = session?.role === 'team' && session?.name ? getTeamStats(session.name) : null;
  const remainingBudget = myTeamStats ? myTeamStats.remaining : 0;

  // Loading skeleton screen
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '2rem' }} className="animate-pulse">
        <div style={{ height: '4rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }} />
        <div className="responsive-grid-3col">
          <div style={{ height: '24rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px' }} />
          <div style={{ height: '24rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px' }} />
          <div style={{ height: '24rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px' }} />
        </div>
      </div>
    );
  }

  // Not Found screen
  if (!activeAuction) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1.5rem', textAlign: 'center' }}>
        <ShieldAlert size={64} style={{ color: 'var(--warning)', filter: 'drop-shadow(0 0 10px rgba(245, 158, 11, 0.4))' }} />
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>Auction Room Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', maxWidth: '400px' }}>
            The auction room "{auctionRoomName}" does not exist in the database or might have been renamed.
          </p>
        </div>
        <button onClick={() => router.push('/auctions')} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Back to Auctions
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="animate-slide-up">
      {/* Top Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className="badge badge-captain" style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>
              {activeAuction.status}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Room:</span>
          </div>
          <h1 className="page-title" style={{ marginTop: '0.25rem' }}>
            {activeAuction.name}
          </h1>
        </div>

        <div className="page-actions">
          <button
            onClick={() => router.push(`/auctions/${encodeURIComponent(auctionUuid)}/dashboard`)}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: 'var(--info)', color: 'var(--info)' }}
          >
            <TrendingUp size={14} />
            <span>Dashboard</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => router.push(`/auctions/${encodeURIComponent(auctionUuid)}/players`)}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: 'var(--primary)', color: 'var(--primary)' }}
            >
              <Users size={14} />
              <span>Manage Players</span>
            </button>
          )}
          {isAdmin && activeAuction.status === 'Draft' && (
            <button
              onClick={() => handleAuctionStatusAction('activate')}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Play size={14} fill="#fff" />
              <span>Start Auction</span>
            </button>
          )}
          {isAdmin && activeAuction.status === 'Active' && (
            <button
              onClick={() => handleAuctionStatusAction('complete')}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--success)', borderColor: 'var(--success)' }}
            >
              <CheckCircle size={14} />
              <span>Complete Auction</span>
            </button>
          )}
          {isAdmin && activeAuction.status === 'Active' && (
            <button
              onClick={handleTogglePause}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: activeAuction.isPaused ? 'var(--success)' : 'var(--warning)', color: activeAuction.isPaused ? 'var(--success)' : 'var(--warning)', background: 'transparent' }}
            >
              {activeAuction.isPaused ? <Play size={14} fill="var(--success)" /> : <Pause size={14} fill="var(--warning)" />}
              <span>{activeAuction.isPaused ? 'Resume Auction' : 'Pause Auction'}</span>
            </button>
          )}
          <button
            onClick={fetchData}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <RefreshCw size={16} />
            <span>Sync Console</span>
          </button>
        </div>
      </div>

      {/* Draft State Screen */}
      {activeAuction.status === 'Draft' && (
        <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' }}>
          <Lock size={48} style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }} />
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Auction Room Locked (Draft Mode)</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '550px', margin: '0 auto 2rem' }}>
            {isAdmin
              ? 'This auction round is currently in Draft mode. Click "Manage Players" to assign players to this round, then click "Start Auction" to begin live bidding.'
              : 'This auction room is waiting to be activated by the administrator. Once activated, live bidding will start automatically!'
            }
          </p>

          <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'left' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
              Participating Teams ({activeAuction.teams.length})
            </h3>
            {activeAuction.teams.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No teams registered for this round.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                {activeAuction.teams.map((tName: string) => {
                  const stats = getTeamStats(tName);
                  return (
                    <div key={tName} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{tName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        Budget: {formatCurrency(stats.initialBudget)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Completed State Screen */}
      {activeAuction.status === 'Completed' && (
        <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center', border: '1px solid var(--success)', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.01)' }}>
          <Sparkles size={48} style={{ color: 'var(--success)', marginBottom: '1.5rem', filter: 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.4))' }} />
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--success)' }}>Auction Round Completed!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '550px', margin: '0 auto 2.5rem' }}>
            The draft has concluded. All acquired players and statistics have been finalized in the database workbook.
          </p>

          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
              Final Standings & Rosters
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {activeAuction.teams.map((tName: string) => {
                const stats = getTeamStats(tName);
                const roster = players.filter(p => p.team === tName && p.auctionName === auctionRoomName);

                return (
                  <div key={tName} className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>{tName}</div>
                        <span className="badge badge-sold" style={{ fontSize: '0.7rem' }}>
                          {roster.length} Players
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                        {roster.length === 0 ? (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No players drafted.</div>
                        ) : (
                          roster.map(p => (
                            <div key={p.mobile} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: '0.25rem' }}>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{p.name}</span>
                              <span style={{ color: 'var(--text-secondary)' }}>{formatCurrency(p.soldPrice || 50000)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Spent: {formatCurrency(stats.spent)}</span>
                      <span style={{ color: 'var(--success)' }}>Remaining: {formatCurrency(stats.remaining)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Active State Console */}
      {activeAuction.status === 'Active' && (
        <>
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

          {/* Stats Summary Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }} className="stats-grid">
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

          {/* Main Grid */}
          <div className="responsive-grid-3col">
            {/* Live Console */}
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
                          background: activeAuction.isPaused ? 'rgba(245, 158, 11, 0.2)' : timeLeft <= 5 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0,0,0,0.3)',
                          color: activeAuction.isPaused ? 'var(--warning)' : timeLeft <= 5 ? 'var(--danger)' : 'var(--warning)',
                          border: activeAuction.isPaused ? '1px solid var(--warning)' : timeLeft <= 5 ? '1px solid var(--danger)' : '1px solid var(--border-color)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          animation: activeAuction.isPaused ? 'none' : timeLeft <= 5 ? 'pulse 0.5s infinite alternate' : 'none'
                        }}
                      >
                        <span>{activeAuction.isPaused ? '⏸️' : '⏱️'}</span>
                        <span>{activeAuction.isPaused ? `PAUSED (${timeLeft}s)` : timeLeft > 0 ? `${timeLeft}s` : 'Time Out'}</span>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <div className="bid-amount">
                        {formatCurrency(bidAmount)}
                      </div>
                      {activeAuction.currentBidderTeam && (
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          Bidder: <span style={{ color: 'var(--primary)' }}>{activeAuction.currentBidderTeam}</span>
                        </div>
                      )}
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

                  {/* Team Bidding Section */}
                  {session?.role === 'team' && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        <span>Place Bid Increment:</span>
                        <span>Your Budget: <strong style={{ color: 'var(--success)' }}>{formatCurrency(remainingBudget)}</strong></span>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handlePlaceBid(50000)}
                          disabled={isBidding || activeAuction.isPaused || timeLeft === 0 || (activeAuction.currentBidderTeam || '').toLowerCase() === (session?.name || '').toLowerCase() || (activeAuction.currentBidPrice + 50000) > remainingBudget}
                          className="btn btn-secondary"
                          style={{ flex: 1, padding: '0.75rem', fontSize: '0.85rem', border: '1px solid var(--info)', color: 'var(--info)', background: 'transparent' }}
                        >
                          +50,000 INR
                        </button>
                        <button
                          onClick={() => handlePlaceBid(100000)}
                          disabled={isBidding || activeAuction.isPaused || timeLeft === 0 || (activeAuction.currentBidderTeam || '').toLowerCase() === (session?.name || '').toLowerCase() || (activeAuction.currentBidPrice + 100000) > remainingBudget}
                          className="btn btn-secondary"
                          style={{ flex: 1, padding: '0.75rem', fontSize: '0.85rem', border: '1px solid var(--info)', color: 'var(--info)', background: 'transparent' }}
                        >
                          +100,000 INR
                        </button>
                        <button
                          onClick={() => handlePlaceBid(500000)}
                          disabled={isBidding || activeAuction.isPaused || timeLeft === 0 || (activeAuction.currentBidderTeam || '').toLowerCase() === (session?.name || '').toLowerCase() || (activeAuction.currentBidPrice + 500000) > remainingBudget}
                          className="btn btn-secondary"
                          style={{ flex: 1, padding: '0.75rem', fontSize: '0.85rem', border: '1px solid var(--info)', color: 'var(--info)', background: 'transparent' }}
                        >
                          +500,000 INR
                        </button>
                      </div>

                      {activeAuction.isPaused && (
                        <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--warning)', fontWeight: 700, marginTop: '0.5rem', animation: 'pulse 1.5s infinite' }}>
                          ⏸ Bidding is temporarily paused by the administrator.
                        </div>
                      )}

                      {timeLeft === 0 && !activeAuction.isPaused && (
                        <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--danger)', fontWeight: 700, marginTop: '0.5rem', animation: 'pulse 1s infinite' }}>
                          ⏱ Bidding has timed out! Waiting for administrator action.
                        </div>
                      )}

                      {(activeAuction.currentBidderTeam || '').toLowerCase() === (session?.name || '').toLowerCase() && timeLeft !== 0 && !activeAuction.isPaused && (
                        <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600, marginTop: '0.5rem' }}>
                          🎉 Your team holds the highest bid!
                        </div>
                      )}

                      {remainingBudget < (activeAuction.currentBidPrice + 50000) && !activeAuction.isPaused && (
                        <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--danger)', fontWeight: 600, marginTop: '0.5rem' }}>
                          ⚠ Insufficient budget to place a higher bid!
                        </div>
                      )}
                    </div>
                  )}

                  {/* Admin Bid Allocation / Highest Bidder Form */}
                  {isAdmin && (
                    <div style={{ marginBottom: '2rem' }}>
                      <label className="form-label">Highest Bidder Team</label>
                      <select
                        className="form-input"
                        value={selectedTeamName}
                        onChange={(e) => handleAdminSelectBidder(e.target.value)}
                        style={{ cursor: 'pointer' }}
                      >
                        <option value="">Select Bidding Team...</option>
                        {teams.map(t => {
                          const stats = getTeamStats(t.name);
                          return (
                            <option key={t.name} value={t.name}>
                              {t.name} (Budget Left: {formatCurrency(stats.remaining)})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {isAdmin ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                          onClick={handleSold}
                          disabled={isActionLoading || (!selectedTeamName && !activeAuction.currentBidderTeam)}
                          className="btn btn-primary"
                          style={{ flex: 1, padding: '0.85rem', fontSize: '0.95rem', backgroundColor: 'var(--success)', borderColor: 'var(--success)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                        >
                          <Check size={18} />
                          <span>Mark Sold</span>
                        </button>
                        <button
                          onClick={handleUnsold}
                          disabled={isActionLoading}
                          className="btn btn-secondary"
                          style={{ flex: 1, padding: '0.85rem', fontSize: '0.95rem', borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                        >
                          <XCircle size={18} style={{ color: 'var(--danger)' }} />
                          <span>Unsold</span>
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                          onClick={handleResetBid}
                          disabled={isActionLoading}
                          className="btn btn-secondary"
                          style={{ flex: 1, padding: '0.85rem', fontSize: '0.95rem', borderColor: 'var(--warning)', color: 'var(--warning)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                        >
                          <RefreshCw size={14} style={{ color: 'var(--warning)' }} />
                          <span>Reset Bid</span>
                        </button>
                        <button
                          onClick={handleTogglePause}
                          disabled={isActionLoading}
                          className="btn btn-secondary"
                          style={{ flex: 1, padding: '0.85rem', fontSize: '0.95rem', borderColor: activeAuction.isPaused ? 'var(--success)' : 'var(--warning)', color: activeAuction.isPaused ? 'var(--success)' : 'var(--warning)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                        >
                          {activeAuction.isPaused ? <Play size={14} fill="var(--success)" /> : <Pause size={14} fill="var(--warning)" />}
                          <span>{activeAuction.isPaused ? 'Resume' : 'Pause'}</span>
                        </button>
                      </div>
                      <button
                        onClick={handleCancelBidding}
                        disabled={isActionLoading}
                        className="btn btn-secondary"
                        style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem', borderColor: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)' }}
                      >
                        Cancel Bidding
                      </button>
                    </div>
                  ) : (
                    <div style={{ padding: '1rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {session?.role === 'team' ? 'Place bid increments above to join live drafting.' : 'Login as a team representative to participate in this auction round.'}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ flex: 1, minHeight: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-color)', borderRadius: '16px', padding: '2rem', textAlign: 'center' }}>
                  <Coins size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Bidding Block Empty</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '280px' }}>
                    {isAdmin ? 'Select a player from the queue to start live bidding.' : 'Waiting for the administrator to place a player on the block.'}
                  </p>
                </div>
              )}
            </div>

            {/* Middle Column: Standing / Team Summary Board */}
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trophy style={{ color: 'var(--primary)' }} /> Team Standings
              </h2>
              <div className="glass-panel" style={{ padding: '1.25rem', height: '100%', overflowY: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {activeAuction.teams.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>No teams participating.</div>
                  ) : (
                    activeAuction.teams.map((tName: string) => {
                      const stats = getTeamStats(tName);
                      return (
                        <div key={tName} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{tName}</div>
                            <span className="badge badge-sold" style={{ fontSize: '0.7rem' }}>{stats.playerCount} Players</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            <span>Spent: {formatCurrency(stats.spent)}</span>
                            <span style={{ color: stats.remaining <= 1000000 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                              Left: {formatCurrency(stats.remaining)}
                            </span>
                          </div>
                          {stats.captain && stats.captain !== 'Not Assigned' && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Captain: <span style={{ color: 'var(--primary)' }}>{stats.captain}</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Unsold Players / Block Queue */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users style={{ color: 'var(--primary)' }} /> Players Pool
                </h2>
                {/* Role Filter dropdown */}
                <select
                  className="form-input"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  style={{ width: 'fit-content', padding: '0.15rem 0.5rem', fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                >
                  <option value="All">All Roles</option>
                  <option value="Batsman">Batsman</option>
                  <option value="Bowler">Bowler</option>
                  <option value="All Rounder">All Rounder</option>
                  <option value="Wicket Keeper">Wicket Keeper</option>
                </select>
              </div>

              <div className="glass-panel" style={{ padding: '1.25rem', height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search player name..."
                    className="form-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: '2rem', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px' }}>
                  {filteredPlayers.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '2rem' }}>No assigned players available.</div>
                  ) : (
                    filteredPlayers.map(p => (
                      <div
                        key={p.mobile}
                        className="glass-panel"
                        style={{
                          padding: '0.75rem 1rem',
                          background: 'rgba(255,255,255,0.01)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          border: p.status === 'Unsold' ? '1px dashed rgba(239, 68, 68, 0.2)' : '1px solid var(--border-color)'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            {p.name} {p.status === 'Unsold' && <span style={{ color: 'var(--danger)', fontSize: '0.7rem', fontWeight: 700 }}>(Unsold)</span>}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                            {p.playingRole} • Base: {formatCurrency(p.soldPrice || 50000)}
                          </div>
                        </div>

                        {isAdmin && (
                          <button
                            onClick={() => handleStartBidding(p)}
                            disabled={isActionLoading}
                            className="btn btn-primary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <Play size={10} fill="#fff" />
                            <span>Present</span>
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Participating Players Table */}
      <div style={{ marginTop: '5rem', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users style={{ color: 'var(--primary)' }} /> Participating Players ({auctionPlayers.length} / {activeAuction?.playersLimit || 20})
        </h2>

        {auctionPlayers.length === 0 ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No players assigned to this auction room yet.
          </div>
        ) : (
          <div className="glass-panel data-table-wrap" style={{ padding: 0, border: '1px solid var(--border-color)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 650, fontSize: '0.85rem' }}>Photo</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 650, fontSize: '0.85rem' }}>Name</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 650, fontSize: '0.85rem' }}>Role</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 650, fontSize: '0.85rem' }}>Playing As</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 650, fontSize: '0.85rem' }}>Mobile</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 650, fontSize: '0.85rem' }}>Status</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 650, fontSize: '0.85rem' }}>Drafted Team</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 650, fontSize: '0.85rem' }}>Price</th>
                </tr>
              </thead>
              <tbody>
                {auctionPlayers.map((p) => {
                  const isSold = p.status === 'Sold' || p.status === 'Captain';
                  const isUnsold = p.status === 'Unsold';
                  const isAvailable = !isSold && !isUnsold;

                  return (
                    <tr
                      key={p.mobile}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: isSold ? 'rgba(16, 185, 129, 0.01)' : isUnsold ? 'rgba(239, 68, 68, 0.01)' : 'transparent',
                        transition: 'background 0.2s'
                      }}
                    >
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.1)' }}>
                          <ImageKitImage
                            src={getDirectDriveUrl(p.playerPhoto)}
                            alt={p.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100';
                            }}
                          />
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{p.playingRole}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{p.playingAs}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{p.mobile}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {isSold && <span className="badge badge-sold">Sold</span>}
                        {isUnsold && <span className="badge badge-unsold" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>Unsold</span>}
                        {isAvailable && <span className="badge badge-pending">Available</span>}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: isSold ? 'var(--primary)' : 'var(--text-muted)' }}>
                        {p.team || '-'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: isSold ? 'var(--success)' : 'var(--text-secondary)' }}>
                        {p.soldPrice ? formatCurrency(p.soldPrice) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      </div>

      {/* SOLD Celebration Modal Popup Overlay */}
      {celebrationData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flexDirection: 'column', overflowY: 'auto', zIndex: 1000, padding: '2rem 1rem' }} className="animate-fade-in">
          <div className="glass-panel glass-panel-glow" style={{ maxWidth: '500px', width: '100%', padding: '2.5rem', textAlign: 'center', border: '2px solid var(--primary)', position: 'relative', animation: 'scaleUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)', margin: 'auto' }}>

            {/* Sparkles / Confetti animation mock */}
            <div style={{ position: 'absolute', top: '10%', left: '10%', fontSize: '2rem', animation: 'float 3s infinite' }}>✨</div>
            <div style={{ position: 'absolute', top: '15%', right: '15%', fontSize: '2rem', animation: 'float 4s infinite 0.5s' }}>🎉</div>
            <div style={{ position: 'absolute', bottom: '20%', left: '15%', fontSize: '2.5rem', animation: 'float 3.5s infinite 1s' }}>🏏</div>
            <div style={{ position: 'absolute', bottom: '15%', right: '10%', fontSize: '2rem', animation: 'float 4.5s infinite 0.2s' }}>⚡</div>

            <div style={{ width: '150px', height: '150px', borderRadius: '50%', overflow: 'hidden', border: '5px solid var(--primary)', boxShadow: '0 0 30px rgba(245, 158, 11, 0.6)', margin: '0 auto 1.5rem' }}>
              <ImageKitImage
                src={getDirectDriveUrl(celebrationData.player.playerPhoto)}
                alt={celebrationData.player.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=300';
                }}
              />
            </div>

            <div className="badge badge-sold" style={{ fontSize: '0.85rem', padding: '0.35rem 0.85rem', marginBottom: '1rem', letterSpacing: '0.05em' }}>
              SOLD OUT!
            </div>

            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
              {celebrationData.player.name}
            </h2>

            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '1.5rem' }}>
              has been successfully drafted to
            </p>

            <div className="glass-panel" style={{ padding: '1.25rem', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '12px', marginBottom: '2rem' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '0.25rem' }}>
                {celebrationData.team}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                for {formatCurrency(celebrationData.price)}
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

      {/* Manage Auction Players Overlay Dialog Modal */}
      {isManagingPlayers && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '2rem' }} className="animate-fade-in">
          <div className="glass-panel" style={{ maxWidth: '1000px', width: '100%', height: '80vh', display: 'flex', flexDirection: 'column', padding: '2rem', border: '1px solid var(--primary)', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>Manage Auction Players</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Add or remove players from "{activeAuction.name}" room pool.</p>
              </div>
              <button
                onClick={() => setIsManagingPlayers(false)}
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1rem' }}
              >
                Close
              </button>
            </div>

            <div className="responsive-grid-2col" style={{ flex: 1, overflow: 'hidden' }}>
              {/* Column 1: Assigned Players */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Assigned Players ({players.length} / {activeAuction?.playersLimit || 20})</span>
                </h3>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search assigned players..."
                    className="form-input"
                    value={assignedSearch}
                    onChange={(e) => setAssignedSearch(e.target.value)}
                    style={{ paddingLeft: '2rem', fontSize: '0.85rem' }}
                  />
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {players.filter(p => p.name.toLowerCase().includes(assignedSearch.toLowerCase())).length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '2rem' }}>No assigned players match.</div>
                  ) : (
                    players
                      .filter(p => p.name.toLowerCase().includes(assignedSearch.toLowerCase()))
                      .map(p => (
                        <div key={p.mobile} className="glass-panel" style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.01)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{p.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.playingRole} • {p.playingAs}</div>
                          </div>
                          <button
                            onClick={() => handleRemovePlayerFromAuction(p.mobile)}
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent' }}
                          >
                            Remove
                          </button>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Column 2: Available Players */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Available Pools ({availablePlayers.length})
                </h3>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search available players..."
                    className="form-input"
                    value={availableSearch}
                    onChange={(e) => setAvailableSearch(e.target.value)}
                    style={{ paddingLeft: '2rem', fontSize: '0.85rem' }}
                  />
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {availablePlayers.filter(p => p.name.toLowerCase().includes(availableSearch.toLowerCase())).length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '2rem' }}>No available players match.</div>
                  ) : (
                    availablePlayers
                      .filter(p => p.name.toLowerCase().includes(availableSearch.toLowerCase()))
                      .map(p => (
                        <div key={p.mobile} className="glass-panel" style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.01)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                              {p.name} {p.auctionName && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({p.auctionName})</span>}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.playingRole} • {p.playingAs}</div>
                          </div>
                          <button
                            onClick={() => handleAddPlayerToAuction(p.mobile)}
                            className="btn btn-primary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            Add
                          </button>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
