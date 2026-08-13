'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { Player, Auction } from '@/lib/excel';
import { 
  Users, Trophy, CheckCircle, AlertCircle, Search, 
  ArrowLeft, Plus, Trash2, Shield, RefreshCw
} from 'lucide-react';

export default function ManageAuctionPlayersPage({ params }: { params: Promise<{ uuid: string }> }) {
  const resolvedParams = use(params);
  const auctionUuid = decodeURIComponent(resolvedParams.uuid);
  const router = useRouter();

  const [session, setSession] = useState<{ loggedIn: boolean; role?: 'admin' | 'team'; name?: string } | null>(null);
  
  // Data lists
  const [assignedPlayers, setAssignedPlayers] = useState<Player[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [activeAuction, setActiveAuction] = useState<Auction | null>(null);
  const [selectedMobiles, setSelectedMobiles] = useState<string[]>([]);

  // Computed auctionRoomName
  const auctionRoomName = activeAuction?.name || auctionUuid;
  
  // Filters/Searches
  const [assignedSearch, setAssignedSearch] = useState<string>('');
  const [availableSearch, setAvailableSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  
  // UI Loaders & Messages
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Authenticate session
  const checkSession = async () => {
    try {
      const res = await fetch(`/api/auth/session?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setSession(data);
        if (data.role !== 'admin') {
          router.push(`/auctions/${encodeURIComponent(auctionUuid)}`);
        }
      } else {
        router.push('/login');
      }
    } catch (err) {
      console.error('Error fetching session:', err);
      router.push('/login');
    }
  };

  // Fetch players and auctions
  const fetchData = useCallback(async () => {
    try {
      const [resAssigned, resAvailable, resAuctions] = await Promise.all([
        fetch(`/api/players?auctionName=${encodeURIComponent(auctionUuid)}&t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/players?auctionName=${encodeURIComponent(auctionUuid)}&pool=available&t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/auction/list?t=${Date.now()}`, { cache: 'no-store' })
      ]);

      const dataAssigned = await resAssigned.json();
      const dataAvailable = await resAvailable.json();
      const dataAuctions = await resAuctions.json();

      if (dataAssigned.success && dataAvailable.success && dataAuctions.success) {
        setAssignedPlayers(dataAssigned.data || []);
        setAvailablePlayers(dataAvailable.data || []);
        setAuctions(dataAuctions.auctions || []);

        const roomAuction = dataAuctions.auctions.find(
          (a: any) => a.uuid === auctionUuid || a.name.toLowerCase() === auctionUuid.toLowerCase()
        );
        setActiveAuction(roomAuction || null);
        setSelectedMobiles([]); // Reset selection when data is refreshed
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

  // Add player to auction pool
  const handleAddPlayer = async (mobile: string) => {
    const limit = activeAuction?.playersLimit || 20;
    if (assignedPlayers.length >= limit) {
      setError(`Cannot add player. Players limit of ${limit} reached for this auction.`);
      return;
    }

    setIsActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerMobile: mobile,
          auctionName: auctionRoomName,
          action: 'add'
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Player assigned to auction pool successfully.');
        await fetchData();
      } else {
        setError(data.error || 'Failed to add player to auction.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to add player to auction.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Add multiple players to auction pool
  const handleAddMultiplePlayers = async (mobiles: string[]) => {
    if (mobiles.length === 0) return;
    const limit = activeAuction?.playersLimit || 20;
    if (assignedPlayers.length + mobiles.length > limit) {
      setError(`Cannot add players. Adding ${mobiles.length} players would exceed the players limit of ${limit} (currently ${assignedPlayers.length}).`);
      return;
    }

    setIsActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerMobile: mobiles,
          auctionName: auctionRoomName,
          action: 'add'
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(`Assigned ${mobiles.length} player(s) to auction pool successfully.`);
        setSelectedMobiles([]);
        await fetchData();
      } else {
        setError(data.error || 'Failed to add players to auction.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to add players to auction.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Remove player from auction pool
  const handleRemovePlayer = async (mobile: string) => {
    setIsActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerMobile: mobile,
          auctionName: auctionRoomName,
          action: 'remove'
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Player removed from auction pool successfully.');
        await fetchData();
      } else {
        setError(data.error || 'Failed to remove player from auction.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to remove player from auction.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const isAdmin = session?.loggedIn && session?.role === 'admin';

  if (isLoading || !session || !isAdmin) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-secondary)' }}>
        <Shield className="animate-pulse" size={48} style={{ margin: '0 auto 1.5rem', color: 'var(--primary)' }} />
        <h3>Loading Player Controller...</h3>
      </div>
    );
  }

  const assignedPlayersList = assignedPlayers;
  const availablePlayersList = availablePlayers;

  // Filtered assigned list
  const filteredAssigned = assignedPlayersList.filter(p => 
    p.name.toLowerCase().includes(assignedSearch.toLowerCase()) || p.mobile.includes(assignedSearch)
  );

  // Filtered available list
  const filteredAvailable = availablePlayersList.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(availableSearch.toLowerCase()) || p.mobile.includes(availableSearch);
    const matchesRole = roleFilter === 'All' || p.playingRole === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="animate-slide-up" style={{ paddingBottom: '3rem' }}>
      {/* Header Bar */}
      <div className="page-header">
        <div className="page-header-with-back">
          <button 
            onClick={() => router.push(`/auctions/${encodeURIComponent(auctionUuid)}`)}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem', flexShrink: 0 }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="page-title">Assign Players</h1>
            <p className="page-subtitle" style={{ marginTop: 0 }}>
              Manage players pool for <strong>{activeAuction?.name}</strong>. Limit: {assignedPlayersList.length} / {activeAuction?.playersLimit || 20}
            </p>
          </div>
        </div>

        <button 
          onClick={fetchData} 
          className="btn btn-secondary" 
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          disabled={isLoading}
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          <span>Sync</span>
        </button>
      </div>

      {/* Messages */}
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

      {/* Main Grid split */}
      <div className="responsive-grid-2col">
        
        {/* Column 1: Assigned Players */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '500px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Assigned Players ({assignedPlayersList.length} / {activeAuction?.playersLimit || 20})</span>
            <Users size={18} style={{ color: 'var(--primary)' }} />
          </h2>

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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '550px', overflowY: 'auto' }}>
            {filteredAssigned.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '3rem' }}>
                No assigned players match your search.
              </div>
            ) : (
              filteredAssigned.map(p => (
                <div key={p.mobile} className="glass-panel" style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.01)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{p.playingRole} • {p.playingAs}</div>
                  </div>
                  <button 
                    onClick={() => handleRemovePlayer(p.mobile)} 
                    disabled={isActionLoading}
                    className="btn btn-secondary" 
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <Trash2 size={12} />
                    <span>Remove</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Available Pool */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '500px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Available Pools ({availablePlayersList.length})
            </h2>
            <select 
              className="form-input" 
              value={roleFilter} 
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{ width: 'fit-content', padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
            >
              <option value="All">All Roles</option>
              <option value="Batsman">Batsman</option>
              <option value="Bowler">Bowler</option>
              <option value="All Rounder">All Rounder</option>
              <option value="Wicket Keeper">Wicket Keeper</option>
            </select>
          </div>

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

          {filteredAvailable.length > 0 && (
            <div className="glass-panel" style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)', userSelect: 'none' }}>
                <input 
                  type="checkbox" 
                  checked={filteredAvailable.length > 0 && filteredAvailable.every(p => selectedMobiles.includes(p.mobile))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const newMobiles = [...selectedMobiles];
                      filteredAvailable.forEach(p => {
                        if (!newMobiles.includes(p.mobile)) {
                          newMobiles.push(p.mobile);
                        }
                      });
                      setSelectedMobiles(newMobiles);
                    } else {
                      const filteredMobs = filteredAvailable.map(p => p.mobile);
                      setSelectedMobiles(selectedMobiles.filter(m => !filteredMobs.includes(m)));
                    }
                  }}
                  style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 500 }}>Select All Filtered ({filteredAvailable.length})</span>
              </label>

              {selectedMobiles.length > 0 && (
                <button 
                  onClick={() => handleAddMultiplePlayers(selectedMobiles)}
                  disabled={isActionLoading}
                  className="btn btn-primary animate-fade-in"
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Plus size={14} />
                  <span>Add Selected ({selectedMobiles.length})</span>
                </button>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '550px', overflowY: 'auto' }}>
            {filteredAvailable.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '3rem' }}>
                No available players match filter criteria.
              </div>
            ) : (
              filteredAvailable.map(p => (
                <div 
                  key={p.mobile} 
                  className="glass-panel" 
                  style={{ 
                    padding: '0.75rem 1rem', 
                    background: selectedMobiles.includes(p.mobile) ? 'rgba(var(--primary-rgb, 99, 102, 241), 0.05)' : 'rgba(255,255,255,0.01)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem', 
                    border: selectedMobiles.includes(p.mobile) ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => {
                    if (selectedMobiles.includes(p.mobile)) {
                      setSelectedMobiles(selectedMobiles.filter(m => m !== p.mobile));
                    } else {
                      setSelectedMobiles([...selectedMobiles, p.mobile]);
                    }
                  }}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedMobiles.includes(p.mobile)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      if (checked) {
                        setSelectedMobiles(prev => [...prev, p.mobile]);
                      } else {
                        setSelectedMobiles(prev => prev.filter(m => m !== p.mobile));
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {p.name} {p.auctionName && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({p.auctionName})</span>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{p.playingRole} • {p.playingAs}</div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddPlayer(p.mobile);
                    }} 
                    disabled={isActionLoading}
                    className="btn btn-primary" 
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <Plus size={12} />
                    <span>Add</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
