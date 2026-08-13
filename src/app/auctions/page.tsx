'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Player, Team, Auction } from '@/lib/excel';
import { formatCurrency } from '@/lib/utils';
import { 
  Trophy, Users, CheckCircle, AlertCircle, RefreshCw, 
  Plus, Edit2, Trash2, Shield, Settings, Play, Pause, CheckSquare, Square
} from 'lucide-react';

export default function AuctionsManagement() {
  const router = useRouter();
  const [session, setSession] = useState<{ loggedIn: boolean; role?: 'admin' | 'team'; name?: string } | null>(null);
  
  // Data lists
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Creation State
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [newAuctionName, setNewAuctionName] = useState<string>('');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [playersLimit, setPlayersLimit] = useState<number>(20);
  const [timerDuration, setTimerDuration] = useState<number>(120);

  // Editing State
  const [editingAuction, setEditingAuction] = useState<Auction | null>(null);
  const [editAuctionName, setEditAuctionName] = useState<string>('');
  const [editSelectedTeams, setEditSelectedTeams] = useState<string[]>([]);
  const [editPlayersLimit, setEditPlayersLimit] = useState<number>(20);
  const [editTimerDuration, setEditTimerDuration] = useState<number>(120);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.success) {
        setSession(data);
        if (data.role !== 'admin') {
          // If not admin, redirect to login/home
          router.push('/');
        }
      } else {
        router.push('/login');
      }
    } catch (err) {
      console.error(err);
      router.push('/login');
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [resAuctions, resTeams] = await Promise.all([
        fetch('/api/auction/list?t=' + Date.now(), { cache: 'no-store' }),
        fetch('/api/teams?t=' + Date.now(), { cache: 'no-store' })
      ]);

      const dataAuctions = await resAuctions.json();
      const dataTeams = await resTeams.json();

      if (dataAuctions.success && dataTeams.success) {
        setAuctions(dataAuctions.auctions || []);
        setTeams(dataTeams.data || []);
      } else {
        setError(dataAuctions.error || dataTeams.error || 'Failed to fetch database records.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error syncing data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
    fetchData();
  }, []);

  const handleCreateAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuctionName.trim()) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/auction/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAuctionName,
          teams: selectedTeams,
          playersLimit: playersLimit,
          timerDuration: timerDuration
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('Auction round created successfully!');
        setNewAuctionName('');
        setSelectedTeams([]);
        setIsCreating(false);
        await fetchData();
      } else {
        setError(data.error || 'Failed to create auction');
      }
    } catch (err) {
      console.error(err);
      setError('Network error creating auction.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (auction: Auction) => {
    setEditingAuction(auction);
    setEditAuctionName(auction.name);
    setEditSelectedTeams(auction.teams);
    setEditPlayersLimit(auction.playersLimit || 20);
    setEditTimerDuration(auction.timerDuration || 120);
  };

  const handleEditAuctionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAuction || !editAuctionName.trim()) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/auction/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingAuction.name,
          action: 'edit',
          newName: editAuctionName,
          teams: editSelectedTeams,
          playersLimit: editPlayersLimit,
          timerDuration: editTimerDuration
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('Auction round updated successfully!');
        setEditingAuction(null);
        await fetchData();
      } else {
        setError(data.error || 'Failed to update auction');
      }
    } catch (err) {
      console.error(err);
      setError('Network error updating auction.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAuction = async (name: string) => {
    if (!confirm(`Are you sure you want to delete the auction "${name}"? This cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/auction/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          action: 'delete'
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('Auction round deleted successfully!');
        await fetchData();
      } else {
        setError(data.error || 'Failed to delete auction');
      }
    } catch (err) {
      console.error(err);
      setError('Network error deleting auction.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivateAuction = async (name: string) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/auction/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, action: 'activate' })
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
      setError('Network error activating auction.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteAuction = async (name: string) => {
    if (!confirm(`Are you sure you want to complete the auction "${name}"? Bidding will be closed.`)) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/auction/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, action: 'complete' })
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
      setError('Network error completing auction.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePause = async (name: string, isCurrentlyPaused: boolean) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/auction/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          action: isCurrentlyPaused ? 'resume' : 'pause'
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(isCurrentlyPaused ? `Auction "${name}" resumed!` : `Auction "${name}" paused!`);
        await fetchData();
      } else {
        setError(data.error || 'Failed to toggle pause status.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error toggling pause status.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTeamCreation = (teamName: string) => {
    setSelectedTeams(prev => 
      prev.includes(teamName) ? prev.filter(t => t !== teamName) : [...prev, teamName]
    );
  };

  const handleToggleTeamEditing = (teamName: string) => {
    setEditSelectedTeams(prev => 
      prev.includes(teamName) ? prev.filter(t => t !== teamName) : [...prev, teamName]
    );
  };

  const isAdmin = session?.loggedIn && session?.role === 'admin';

  if (!session || !isAdmin) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-secondary)' }}>
        <Shield className="animate-pulse" size={48} style={{ margin: '0 auto 1.5rem', color: 'var(--danger)' }} />
        <h3>Loading Admin Panel...</h3>
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Auctions Control Room
          </h1>
          <p className="page-subtitle">
            Create new rounds, update participating teams, configure active panels, and delete records.
          </p>
        </div>
        <button 
          onClick={fetchData} 
          className="btn btn-secondary" 
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          disabled={isLoading}
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          <span>Sync Auctions</span>
        </button>
      </div>



      {/* Global Notifications */}
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

      {/* Action Buttons */}
      <div style={{ marginBottom: '2rem' }}>
        {!isCreating && !editingAuction && (
          <button 
            onClick={() => setIsCreating(true)} 
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={16} />
            <span>Create New Auction Round</span>
          </button>
        )}
      </div>

      {/* Create Auction Form Panel */}
      {isCreating && (
        <div className="glass-panel animate-slide-up" style={{ padding: '2rem', marginBottom: '2rem', border: '1px solid var(--primary)' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus style={{ color: 'var(--primary)' }} /> Create New Auction Round
          </h2>
          <form onSubmit={handleCreateAuction} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', width: '100%' }}>
              <div style={{ maxWidth: '500px' }}>
                <label className="form-label">Auction Name *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Deshottar Premier League 2026" 
                  className="form-input"
                  value={newAuctionName}
                  onChange={(e) => setNewAuctionName(e.target.value)}
                  required
                />
              </div>
              <div style={{ maxWidth: '200px' }}>
                <label className="form-label">Players Limit *</label>
                <input 
                  type="number" 
                  min="1"
                  max="500"
                  className="form-input"
                  value={playersLimit}
                  onChange={(e) => setPlayersLimit(Number(e.target.value))}
                  required
                />
              </div>
              <div style={{ maxWidth: '200px' }}>
                <label className="form-label">Bidding Timer (Seconds) *</label>
                <input 
                  type="number" 
                  min="5"
                  max="600"
                  className="form-input"
                  value={timerDuration}
                  onChange={(e) => setTimerDuration(Number(e.target.value))}
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                  {Math.floor(timerDuration / 60)} min {timerDuration % 60} sec
                </span>
              </div>
            </div>

            <div>
              <label className="form-label" style={{ marginBottom: '0.75rem' }}>Select Participating Teams</label>
              {teams.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No teams registered yet. Please create teams first.</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {teams.map(t => {
                    const isSelected = selectedTeams.includes(t.name);
                    return (
                      <button
                        key={t.name}
                        type="button"
                        onClick={() => handleToggleTeamCreation(t.name)}
                        className="btn"
                        style={{
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          background: isSelected ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.02)',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                          color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                          fontWeight: isSelected ? 700 : 400
                        }}
                      >
                        {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                        <span>{t.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <button type="submit" disabled={isLoading} className="btn btn-primary">
                Create Round
              </button>
              <button type="button" onClick={() => { setIsCreating(false); setNewAuctionName(''); setSelectedTeams([]); }} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Auction Form Panel */}
      {editingAuction && (
        <div className="glass-panel animate-slide-up" style={{ padding: '2rem', marginBottom: '2rem', border: '1px solid var(--info)' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Edit2 style={{ color: 'var(--info)' }} /> Edit Auction: {editingAuction.name}
          </h2>
          <form onSubmit={handleEditAuctionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', width: '100%' }}>
              <div style={{ maxWidth: '500px' }}>
                <label className="form-label">Rename Auction Round *</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={editAuctionName}
                  onChange={(e) => setEditAuctionName(e.target.value)}
                  required
                />
              </div>
              <div style={{ maxWidth: '200px' }}>
                <label className="form-label">Players Limit *</label>
                <input 
                  type="number" 
                  min="1"
                  max="500"
                  className="form-input"
                  value={editPlayersLimit}
                  onChange={(e) => setEditPlayersLimit(Number(e.target.value))}
                  required
                />
              </div>
              <div style={{ maxWidth: '200px' }}>
                <label className="form-label">Bidding Timer (Seconds) *</label>
                <input 
                  type="number" 
                  min="5"
                  max="600"
                  className="form-input"
                  value={editTimerDuration}
                  onChange={(e) => setEditTimerDuration(Number(e.target.value))}
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                  {Math.floor(editTimerDuration / 60)} min {editTimerDuration % 60} sec
                </span>
              </div>
            </div>

            <div>
              <label className="form-label" style={{ marginBottom: '0.75rem' }}>Participating Teams</label>
              {teams.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No teams registered yet.</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {teams.map(t => {
                    const isSelected = editSelectedTeams.includes(t.name);
                    return (
                      <button
                        key={t.name}
                        type="button"
                        onClick={() => handleToggleTeamEditing(t.name)}
                        className="btn"
                        style={{
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                          border: isSelected ? '1px solid var(--info)' : '1px solid var(--border-color)',
                          color: isSelected ? 'var(--info)' : 'var(--text-secondary)',
                          fontWeight: isSelected ? 700 : 400
                        }}
                      >
                        {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                        <span>{t.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <button type="submit" disabled={isLoading} className="btn btn-primary" style={{ backgroundColor: 'var(--info)', borderColor: 'var(--info)' }}>
                Save Changes
              </button>
              <button type="button" onClick={() => setEditingAuction(null)} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Auctions List Grid */}
      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Trophy style={{ color: 'var(--primary)' }} /> Tournament Auction Rounds ({auctions.length})
      </h2>

      {auctions.length === 0 ? (
        <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', borderStyle: 'dashed' }}>
          <Trophy size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>No Auctions Configured</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Create an auction round to start the bidding draft process.</p>
        </div>
      ) : (
        <div className="card-grid-lg">
          {auctions.map((auction) => {
            const isActive = auction.status === 'Active';
            const isCompleted = auction.status === 'Completed';
            
            return (
              <div 
                key={auction.name}
                className="glass-panel"
                style={{
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: isActive ? '1px solid rgba(245, 158, 11, 0.4)' : 
                          isCompleted ? '1px solid rgba(16, 185, 129, 0.2)' : 
                          '1px solid var(--border-color)',
                  background: isActive ? 'rgba(245, 158, 11, 0.03)' : 
                              isCompleted ? 'rgba(16, 185, 129, 0.02)' : 
                              'var(--bg-card)',
                  boxShadow: isActive ? '0 8px 30px rgba(245, 158, 11, 0.05)' : 'none'
                }}
              >
                <div>
                  {/* Title & Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', maxWidth: '70%' }}>
                      {auction.name}
                    </h3>
                    <div>
                      {isActive && !auction.isPaused && <span className="badge badge-captain" style={{ animation: 'pulse 2s infinite' }}>Active</span>}
                      {isActive && auction.isPaused && <span className="badge badge-pending" style={{ animation: 'pulse 2s infinite', background: 'rgba(245, 158, 11, 0.2)', color: 'var(--warning)', border: '1px solid var(--warning)' }}>Paused</span>}
                      {isCompleted && <span className="badge badge-sold">Completed</span>}
                      {auction.status === 'Draft' && <span className="badge badge-pending">Draft</span>}
                    </div>
                  </div>

                  {/* Players Limit & Bidding Timer info */}
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Users size={14} style={{ color: 'var(--primary)' }} />
                      <span>Limit: <strong>{auction.playersLimit || 20}</strong></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Settings size={14} style={{ color: 'var(--primary)' }} />
                      <span>Timer: <strong>{Math.floor((auction.timerDuration || 120) / 60)}m {(auction.timerDuration || 120) % 60}s</strong></span>
                    </div>
                  </div>

                  {/* Registered Teams Summary */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Participating Teams ({auction.teams.length})
                    </div>
                    {auction.teams.length === 0 ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No teams participating.</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {auction.teams.map(tName => (
                          <span 
                            key={tName} 
                            style={{ 
                              fontSize: '0.7rem', 
                              padding: '0.15rem 0.5rem', 
                              background: 'rgba(255,255,255,0.05)', 
                              borderRadius: '4px',
                              color: 'var(--text-primary)',
                              border: '1px solid rgba(255,255,255,0.05)'
                            }}
                          >
                            {tName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="auction-card-footer">
                  <div className="auction-card-actions">
                    <a 
                      href={`/auctions/${encodeURIComponent(auction.uuid || auction.name)}`}
                      className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.65rem', fontSize: '0.75rem', textDecoration: 'none', color: '#fff' }}
                    >
                      <Play size={12} fill="#fff" />
                      <span>Enter Room</span>
                    </a>
                    <a 
                      href={`/auctions/${encodeURIComponent(auction.uuid || auction.name)}/players`}
                      className="btn btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.65rem', fontSize: '0.75rem', textDecoration: 'none', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                    >
                      <Users size={12} />
                      <span>Manage Players</span>
                    </a>
                    {!isActive && !isCompleted && (
                      <button 
                        onClick={() => handleActivateAuction(auction.name)}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.65rem', fontSize: '0.75rem', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                      >
                        <Play size={12} fill="var(--primary)" />
                        <span>Activate</span>
                      </button>
                    )}
                    {isActive && (
                      <button 
                        onClick={() => handleCompleteAuction(auction.name)}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.65rem', fontSize: '0.75rem', borderColor: 'var(--success)', color: 'var(--success)' }}
                      >
                        <CheckCircle size={12} />
                        <span>Complete</span>
                      </button>
                    )}
                    {isActive && (
                      <button 
                        onClick={() => handleTogglePause(auction.name, !!auction.isPaused)}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.65rem', fontSize: '0.75rem', borderColor: auction.isPaused ? 'var(--success)' : 'var(--warning)', color: auction.isPaused ? 'var(--success)' : 'var(--warning)', background: 'transparent' }}
                      >
                        {auction.isPaused ? <Play size={12} fill="var(--success)" /> : <Pause size={12} fill="var(--warning)" />}
                        <span>{auction.isPaused ? 'Resume' : 'Pause'}</span>
                      </button>
                    )}
                    <button 
                      onClick={() => handleEditClick(auction)}
                      className="btn btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                    >
                      <Edit2 size={12} />
                      <span>Edit</span>
                    </button>
                  </div>

                  <button 
                    onClick={() => handleDeleteAuction(auction.name)}
                    className="btn btn-secondary"
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.25rem', 
                      padding: '0.35rem 0.65rem', 
                      fontSize: '0.75rem', 
                      borderColor: 'rgba(239, 68, 68, 0.2)', 
                      color: 'var(--danger)' 
                    }}
                  >
                    <Trash2 size={12} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
