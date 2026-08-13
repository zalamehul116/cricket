'use client';

import { useState, useEffect } from 'react';
import { Player, Team } from '@/lib/excel';
import { formatCurrency, getDirectDriveUrl } from '@/lib/utils';
import ImageKitImage from '@/components/ImageKitImage';
import { 
  ShieldAlert, ShieldCheck, UserPlus, Coins, Image, 
  User, CheckCircle, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Edit
} from 'lucide-react';


export default function TeamsAndCaptains() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [auctions, setAuctions] = useState<any[]>([]);
  const [selectedAuctionName, setSelectedAuctionName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasMounted, setHasMounted] = useState<boolean>(false);
  const [session, setSession] = useState<{ loggedIn: boolean; role?: 'admin' | 'team'; name?: string } | null>(null);
  
  // Roster collapse/expand state
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  // Forms State
  // 1. Team Registration / Edit
  const [editingTeamOriginalName, setEditingTeamOriginalName] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string>('');
  const [ownerName, setOwnerName] = useState<string>('');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [passcode, setPasscode] = useState<string>('');
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState<boolean>(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    
    setIsUploadingLogo(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.url) {
        setLogoUrl(data.url);
        setSuccess('Team logo uploaded successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to upload team logo');
      }
    } catch (err) {
      console.error(err);
      setError('Network error uploading logo');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // 2. Captain Assignment
  const [selectedTeamForCaptain, setSelectedTeamForCaptain] = useState<string>('');
  const [selectedPlayerForCaptain, setSelectedPlayerForCaptain] = useState<string>('');
  const [teamBudgetForAuction, setTeamBudgetForAuction] = useState<number>(10000000); // 1 Crore default
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  // Global messages
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.success) {
        setSession(data);
      }
    } catch (err) {
      console.error('Session API check failed:', err);
    }
  };

  const fetchData = async (auctionFilter?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const playerUrl = auctionFilter 
        ? `/api/players?auctionName=${encodeURIComponent(auctionFilter)}&t=${Date.now()}` 
        : `/api/players?t=${Date.now()}`;
      
      const teamUrl = auctionFilter 
        ? `/api/teams?auctionName=${encodeURIComponent(auctionFilter)}&t=${Date.now()}` 
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
        setPlayers(dataPlayers.data);
        setTeams(dataTeams.data);
        setAuctions(dataAuctions.auctions || []);
      } else {
        setError(dataPlayers.error || dataTeams.error || dataAuctions.error || 'Failed to fetch data');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while loading data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setHasMounted(true);
    checkSession();
  }, []);

  useEffect(() => {
    fetchData(selectedAuctionName);
  }, [selectedAuctionName]);

  // Handle Team Registration / Update
  const handleRegisterTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) {
      setError('Team name is required');
      return;
    }

    setIsRegistering(true);
    setError(null);
    setSuccess(null);
    try {
      const isEdit = !!editingTeamOriginalName;
      const url = '/api/teams';
      const method = isEdit ? 'PUT' : 'POST';
      
      const payload = isEdit 
        ? {
            originalName: editingTeamOriginalName,
            team: {
              name: teamName,
              owner: ownerName,
              logo: logoUrl,
              passcode: passcode
            }
          }
        : {
            name: teamName,
            owner: ownerName,
            logo: logoUrl,
            passcode: passcode
          };

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (result.success) {
        setSuccess(isEdit 
          ? `Team updated successfully!` 
          : `Team ${teamName} registered successfully in the Excel sheet!`
        );
        // Reset form
        setTeamName('');
        setOwnerName('');
        setLogoUrl('');
        setPasscode('');
        setEditingTeamOriginalName(null);
        fetchData(selectedAuctionName);
      } else {
        setError(result.error || `Failed to ${isEdit ? 'update' : 'register'} team`);
      }
    } catch (err) {
      console.error(err);
      setError(`Network error ${editingTeamOriginalName ? 'updating' : 'registering'} team`);
    } finally {
      setIsRegistering(false);
    }
  };

  // Handle Captain Assignment
  const handleAssignCaptain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamForCaptain) {
      setError('Please select a team');
      return;
    }

    setIsAssigning(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/teams/assign-captain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: selectedTeamForCaptain,
          playerMobile: selectedPlayerForCaptain,
          auctionName: selectedAuctionName || undefined,
          budget: teamBudgetForAuction
        })
      });

      const result = await res.json();
      if (result.success) {
        setSuccess(`Captain and budget configuration updated successfully!`);
        setSelectedPlayerForCaptain('');
        fetchData(selectedAuctionName);
      } else {
        setError(result.error || 'Failed to update configuration');
      }
    } catch (err) {
      console.error(err);
      setError('Network error updating team configuration');
    } finally {
      setIsAssigning(false);
    }
  };

  // Get spent & remaining budgets dynamically
  const getTeamRosterStats = (teamName: string) => {
    const teamPlayers = players.filter(p => p.team === teamName);
    const spent = teamPlayers.reduce((sum, p) => sum + (p.soldPrice ? Number(p.soldPrice) : 0), 0);
    const teamObj = teams.find(t => t.name === teamName);
    const initialBudget = teamObj ? teamObj.budget : 10000000;
    return {
      spent,
      remaining: initialBudget - spent,
      playersList: teamPlayers,
      count: teamPlayers.length
    };
  };

  // List of players eligible to be captain (only participating players in the selected auction)
  const getEligibleCaptains = () => {
    return players.filter(p => {
      // Must be participating in the selected auction
      if (selectedAuctionName && p.auctionName !== selectedAuctionName) {
        return false;
      }
      const isAvailable = p.status === '' || p.status === 'Unsold';
      const isCurrentCaptainOfThisTeam = p.status === 'Captain' && p.team === selectedTeamForCaptain;
      return isAvailable || isCurrentCaptainOfThisTeam;
    });
  };

  const isAdmin = session?.loggedIn && session?.role === 'admin';

  const selectedAuction = auctions.find(a => a.name === selectedAuctionName);
  const filteredTeams = selectedAuction 
    ? teams.filter(t => selectedAuction.teams.includes(t.name)) 
    : teams;

  return (
    <div className="animate-slide-up">
      {/* Page Header */}
      <div className="teams-page-header page-header">
        <div>
          <h1 className="teams-page-title page-title">
            Teams & Captains Management
          </h1>
          <p className="teams-page-subtitle page-subtitle">
            {isAdmin 
              ? 'Register new teams, assign captains, and configure rosters. All changes sync directly to the tournament workbook.'
              : 'Registered teams, captains, budgets, and roster members.'
            }
          </p>
        </div>
        
        <div className="teams-page-controls page-actions">
          <div className="teams-filter-group">
            <label className="form-label" style={{ marginBottom: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Auction Room Filter</label>
            <select
              className="form-input teams-filter-select"
              value={selectedAuctionName}
              onChange={(e) => {
                setSelectedAuctionName(e.target.value);
                setSelectedTeamForCaptain('');
                setSelectedPlayerForCaptain('');
              }}
            >
              <option value="">-- All Auctions / Teams --</option>
              {auctions.map(a => (
                <option key={a.name} value={a.name}>{a.name} ({a.status})</option>
              ))}
            </select>
          </div>

          <button 
            onClick={() => fetchData(selectedAuctionName)} 
            className="btn btn-secondary teams-sync-btn" 
            disabled={!hasMounted || isLoading}
          >
            <RefreshCw size={16} className={(hasMounted && isLoading) ? 'animate-spin' : ''} />
            <span>Sync Database</span>
          </button>
        </div>
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

      {/* Two-Column or One-Column Grid depending on Admin permissions */}
      <div className={`teams-grid-container${isAdmin ? ' teams-grid-admin' : ''}`}>
        {/* Left Column - Forms (Admin Only) */}
        {isAdmin && (
          <div className="teams-form-stack">
             {/* Team Registration Form */}
            <div className="glass-panel teams-form-panel">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                <UserPlus size={20} /> {editingTeamOriginalName ? 'Edit Team Details' : 'Register Team'}
              </h2>
              <form onSubmit={handleRegisterTeam} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="form-label">Team Name *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Deshottar Kings" 
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Owner Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Mehul Zala" 
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Team Logo</label>
                  <div className="teams-logo-row">
                    <input 
                      type="text" 
                      className="form-input teams-logo-input" 
                      placeholder="Paste Logo URL or upload a file" 
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                    />
                    <div className="teams-logo-upload">
                      <label className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.65rem 1rem', fontSize: '0.85rem' }}>
                        <span>{isUploadingLogo ? 'Uploading...' : 'Upload Logo'}</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleLogoUpload} 
                          disabled={isUploadingLogo} 
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                        />
                      </label>
                    </div>
                  </div>
                  {logoUrl && (
                    <div className="teams-logo-preview">
                      <div className="teams-logo-preview-img">
                        <ImageKitImage src={getDirectDriveUrl(logoUrl)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} sizes="48px" />
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Logo Preview</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="form-label">Team Login Passcode *</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="Enter passcode for team portal..." 
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    required
                  />
                </div>
                <div className="teams-form-actions">
                  <button 
                    type="submit" 
                    disabled={isRegistering} 
                    className={`btn btn-primary ${isRegistering ? 'btn-disabled' : ''}`}
                  >
                    {isRegistering 
                      ? (editingTeamOriginalName ? 'Updating...' : 'Writing to Excel...') 
                      : (editingTeamOriginalName ? 'Save Changes' : 'Register Team')
                    }
                  </button>
                  {editingTeamOriginalName && (
                    <button
                      type="button"
                      onClick={() => {
                        setTeamName('');
                        setOwnerName('');
                        setLogoUrl('');
                        setPasscode('');
                        setEditingTeamOriginalName(null);
                      }}
                      className="btn btn-secondary"
                      style={{ border: '1px solid var(--danger)', color: 'var(--danger)' }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Captain Assignment Form */}
            <div className="glass-panel teams-form-panel">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--info)' }}>
                <ShieldCheck size={20} /> Assign Team Captain
              </h2>
              <form onSubmit={handleAssignCaptain} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="form-label">Auction Room *</label>
                  <select 
                    className="form-input"
                    value={selectedAuctionName}
                    onChange={(e) => {
                      setSelectedAuctionName(e.target.value);
                      setSelectedTeamForCaptain('');
                      setSelectedPlayerForCaptain('');
                    }}
                    required
                  >
                    <option value="">Choose an auction...</option>
                    {auctions.map(a => (
                      <option key={a.name} value={a.name}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Select Team</label>
                  <select 
                    className="form-input"
                    value={selectedTeamForCaptain}
                    onChange={(e) => {
                      const tName = e.target.value;
                      setSelectedTeamForCaptain(tName);
                      setSelectedPlayerForCaptain('');
                      const tObj = filteredTeams.find(t => t.name === tName);
                      if (tObj) {
                        setTeamBudgetForAuction(tObj.budget);
                      }
                    }}
                    required
                    disabled={!selectedAuctionName}
                  >
                    <option value="">Choose a team...</option>
                    {filteredTeams.map(t => (
                      <option key={t.name} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Team Budget for this Auction (INR) *</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={teamBudgetForAuction}
                    onChange={(e) => setTeamBudgetForAuction(Number(e.target.value))}
                    required
                    disabled={!selectedTeamForCaptain}
                  />
                </div>

                <div>
                  <label className="form-label">Select Player (From Sheet)</label>
                  <select 
                    className="form-input"
                    value={selectedPlayerForCaptain}
                    onChange={(e) => setSelectedPlayerForCaptain(e.target.value)}
                    disabled={!selectedTeamForCaptain}
                    required
                  >
                    <option value="">-- Remove Captain / Unassigned --</option>
                    {selectedTeamForCaptain && getEligibleCaptains().map((p, idx) => (
                      <option key={`${p.mobile}-${idx}`} value={p.mobile}>
                        {p.name} ({p.playingRole}) {p.status === 'Captain' ? ' - Current Captain' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <button 
                  type="submit" 
                  disabled={isAssigning || !selectedTeamForCaptain} 
                  className={`btn btn-secondary ${isAssigning || !selectedTeamForCaptain ? 'btn-disabled' : ''}`}
                  style={{ marginTop: '0.5rem', border: '1px solid var(--info)', color: 'var(--info)' }}
                >
                  {isAssigning ? 'Updating Excel...' : 'Confirm Captain Assignment'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Right Column - Teams List & Roster Breakdown */}
        <div>
          <h2 className="teams-section-title">
            <Coins style={{ color: 'var(--primary)' }} /> Registered Teams & Rosters ({filteredTeams.length})
          </h2>
          
          {(!hasMounted || isLoading) ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>Loading rosters...</div>
          ) : filteredTeams.length === 0 ? (
            <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', borderStyle: 'dashed' }}>
              <ShieldAlert size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>No Registered Teams</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {selectedAuctionName 
                  ? 'No teams are registered for the selected auction yet.' 
                  : isAdmin 
                    ? 'Fill out the form on the left to register a team into the Excel sheet.' 
                    : 'No teams have been registered in this tournament workbook yet.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {filteredTeams.map((t) => {
                const roster = getTeamRosterStats(t.name);
                const isExpanded = expandedTeam === t.name;
                
                const auctionCaptainPlayer = players.find(p => p.team === t.name && p.status === 'Captain');
                const captainNameToShow = auctionCaptainPlayer ? auctionCaptainPlayer.name : (selectedAuctionName ? 'Not Assigned' : t.captain || 'Not Assigned');
                const captainMobileToShow = auctionCaptainPlayer ? auctionCaptainPlayer.mobile : (selectedAuctionName ? '' : t.captainMobile || '');

                return (
                  <div 
                    key={t.name}
                    className="glass-panel teams-card"
                    style={{ 
                      border: auctionCaptainPlayer ? '1px solid rgba(245, 158, 11, 0.15)' : '1px solid var(--border-color)'
                    }}
                  >
                    {/* Header */}
                    <div className="teams-card-header">
                      <div className="teams-card-info">
                        {t.logo ? (
                          <div className="teams-card-logo">
                            <ImageKitImage 
                              src={getDirectDriveUrl(t.logo)} 
                              alt={t.name} 
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              sizes="48px"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="teams-card-logo-fallback">
                            {t.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="teams-card-name-wrap">
                          <h3 className="teams-card-name">{t.name}</h3>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Owner: {t.owner || 'N/A'}</p>
                        </div>
                      </div>
                      
                      <div className="teams-card-budget">
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Remaining Budget</div>
                        <div style={{ fontSize: 'clamp(1.1rem, 3vw, 1.3rem)', fontWeight: 800, color: 'var(--primary)' }}>
                          {formatCurrency(roster.remaining)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                          Spent: {formatCurrency(roster.spent)} / {formatCurrency(t.budget)}
                        </div>
                      </div>
                    </div>

                    {/* Team Captain badge */}
                    <div className="teams-card-footer">
                      <div className="teams-captain-info">
                        <span className="badge badge-captain" style={{ fontSize: '0.65rem' }}>Captain</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{captainNameToShow}</strong>
                        {captainMobileToShow && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({captainMobileToShow})</span>}
                      </div>

                      <div className="teams-card-actions">
                        {isAdmin && (
                          <button
                            onClick={() => {
                              setEditingTeamOriginalName(t.name);
                              setTeamName(t.name);
                              setOwnerName(t.owner || '');
                              setLogoUrl(t.logo || '');
                              setPasscode(t.passcode || '');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                          >
                            <Edit size={14} />
                            <span>Edit</span>
                          </button>
                        )}
                        <button
                          onClick={() => setExpandedTeam(isExpanded ? null : t.name)}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          <span>Roster ({roster.count})</span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Roster List */}
                    {isExpanded && (
                      <div style={{ marginTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '1rem' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                          Squad Members:
                        </h4>
                        {roster.playersList.length === 0 ? (
                          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', background: 'rgba(0,0,0,0.1)', borderRadius: '8px' }}>
                            No players drafted to this squad yet.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {roster.playersList.map((p, idx) => (
                              <div 
                                key={`${p.mobile}-${idx}`} 
                                className="teams-roster-row"
                                style={{ borderLeft: p.status === 'Captain' ? '3px solid var(--primary)' : 'none' }}
                              >
                                <div className="teams-roster-player">
                                  <div className="teams-roster-avatar">
                                    <ImageKitImage 
                                      src={getDirectDriveUrl(p.playerPhoto)} 
                                      alt={p.name} 
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                      sizes="28px"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100';
                                      }}
                                    />
                                  </div>
                                  <span className="teams-roster-player-text">
                                    <strong>{p.name}</strong> 
                                    <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem', fontSize: '0.75rem' }}>({p.playingRole})</span>
                                  </span>
                                </div>
                                <span className="teams-roster-price" style={{ color: p.status === 'Captain' ? 'var(--primary)' : 'var(--text-primary)' }}>
                                  {p.status === 'Captain' && p.soldPrice === 0 ? 'Captain' : formatCurrency(p.soldPrice)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
