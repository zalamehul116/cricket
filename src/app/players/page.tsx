'use client';

import { useState, useEffect } from 'react';
import { Player } from '@/lib/excel';
import { getDirectDriveUrl, formatCurrency } from '@/lib/utils';
import ImageKitImage from '@/components/ImageKitImage';
import { Users, Search, Filter, ShieldAlert, CheckCircle, RefreshCw, Smartphone, Play, UserPlus } from 'lucide-react';

export default function PlayersDatabase() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<{ loggedIn: boolean; role?: 'admin' | 'team'; name?: string } | null>(null);
  const [activeAuction, setActiveAuction] = useState<any | null>(null);
  const [isBiddingLoading, setIsBiddingLoading] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState<boolean>(false);
  
  // Bulk Import
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

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

  const fetchActiveAuction = async () => {
    try {
      const res = await fetch('/api/auction/list');
      const data = await res.json();
      if (data.success && data.auctions) {
        const active = data.auctions.find((a: any) => a.status === 'Active');
        setActiveAuction(active || null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPlayers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/players');
      const data = await res.json();
      if (data.success) {
        setPlayers(data.data);
      } else {
        setError(data.error || 'Failed to fetch players');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while loading players.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartBidding = async (player: Player) => {
    if (!activeAuction) {
      alert('Please create and activate an auction first on the Admin Dashboard.');
      return;
    }
    
    setIsBiddingLoading(player.mobile);
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
      const data = await res.json();
      if (data.success) {
        window.location.href = '/';
      } else {
        alert(data.error || 'Failed to start bidding');
      }
    } catch (err) {
      console.error(err);
      alert('Network error starting bidding');
    } finally {
      setIsBiddingLoading(null);
    }
  };

  const [teams, setTeams] = useState<any[]>([]);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    mobile: string;
    playingRole: string;
    playingAs: string;
    playerPhoto: string;
    status: string;
    team: string;
    soldPrice: string;
  }>({
    name: '',
    mobile: '',
    playingRole: '',
    playingAs: '',
    playerPhoto: '',
    status: '',
    team: '',
    soldPrice: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    
    setIsUploadingImage(true);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.url) {
        setEditForm(prev => ({ ...prev, playerPhoto: data.url }));
      } else {
        alert(data.error || 'Failed to upload image');
      }
    } catch (err) {
      console.error(err);
      alert('Network error uploading image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/teams');
      const data = await res.json();
      if (data.success) {
        setTeams(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenEdit = (player: Player) => {
    setEditingPlayer(player);
    setEditForm({
      name: player.name || '',
      mobile: player.mobile || '',
      playingRole: player.playingRole || '',
      playingAs: player.playingAs || '',
      playerPhoto: player.playerPhoto || '',
      status: player.status || '',
      team: player.team || '',
      soldPrice: player.soldPrice !== undefined && player.soldPrice !== null ? player.soldPrice.toString() : ''
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/players', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalMobile: editingPlayer.mobile,
          player: {
            mobile: (editForm.mobile || '').trim(),
            name: (editForm.name || '').trim(),
            playingRole: editForm.playingRole || '',
            playingAs: (editForm.playingAs || '').trim(),
            playerPhoto: (editForm.playerPhoto || '').trim(),
            status: editForm.status || '',
            team: editForm.status === 'Sold' || editForm.status === 'Captain' ? (editForm.team || '') : '',
            soldPrice: editForm.status === 'Sold' || editForm.status === 'Captain' ? (editForm.soldPrice ? Number(editForm.soldPrice) : 0) : '',
            auctionName: editingPlayer.auctionName || activeAuction?.name || ''
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        setEditingPlayer(null);
        fetchPlayers();
      } else {
        alert(data.error || 'Failed to update player');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating player profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    
    setIsImporting(true);
    setImportMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/players/import', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setImportMessage({ type: 'success', text: data.message });
        fetchPlayers();
      } else {
        setImportMessage({ type: 'error', text: data.error || 'Failed to import players.' });
      }
    } catch (err) {
      console.error(err);
      setImportMessage({ type: 'error', text: 'Network error importing players.' });
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    setHasMounted(true);
    checkSession();
    fetchPlayers();
    fetchActiveAuction();
    fetchTeams();
  }, []);

  const filteredPlayers = players.filter((player) => {
    const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          player.mobile.includes(searchQuery);
    const matchesRole = roleFilter === 'All' || player.playingRole === roleFilter;
    
    let matchesStatus = true;
    if (statusFilter !== 'All') {
      if (statusFilter === 'Sold') {
        matchesStatus = player.status === 'Sold';
      } else if (statusFilter === 'Unsold') {
        matchesStatus = player.status === 'Unsold';
      } else if (statusFilter === 'Captain') {
        matchesStatus = player.status === 'Captain';
      } else if (statusFilter === 'Available') {
        matchesStatus = player.status === '' || player.status === 'Unsold';
      }
    }

    return matchesSearch && matchesRole && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Sold':
        return <span className="badge badge-sold">Sold</span>;
      case 'Unsold':
        return <span className="badge badge-unsold">Unsold</span>;
      case 'Captain':
        return <span className="badge badge-captain">Captain</span>;
      default:
        return <span className="badge badge-pending">Available</span>;
    }
  };

  const isAdmin = session?.loggedIn && session?.role === 'admin';

  return (
    <>
      <div className="animate-slide-up">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Players Database
          </h1>
          <p className="page-subtitle">
            View and manage all registered players in the cricket tournament ({players.length} total).
          </p>
        </div>
        <div className="page-actions">
          {isAdmin && (
            <button 
              onClick={() => window.location.href = '/players/create'} 
              className="btn btn-primary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <UserPlus size={16} />
              <span>Create Player</span>
            </button>
          )}
          {hasMounted && (
            <button 
              onClick={fetchPlayers} 
              className="btn btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              disabled={isLoading}
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              <span>Sync Players</span>
            </button>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--border-color-glow)' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={18} />
              <span>Bulk Import Players</span>
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Upload an Excel (.xlsx or .xls) file containing player columns (Name, Mobile No., Playing Role, Playing As, Photo link, etc.) to bulk import players.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <label className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', position: 'relative', cursor: 'pointer' }}>
              <span>{isImporting ? 'Importing...' : 'Choose Excel File'}</span>
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                onChange={handleBulkImport} 
                disabled={isImporting} 
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
              />
            </label>
            {importMessage && (
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: importMessage.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
                {importMessage.text}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }} className="filter-grid">
          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search by name or mobile number..." 
              className="form-input" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          {/* Role Filter */}
          <div>
            <select 
              className="form-input"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              <option value="All">All Roles</option>
              <option value="Batsman">Batsman</option>
              <option value="Bowler">Bowler</option>
              <option value="All-Rounder">All-Rounder</option>
              <option value="Wicket-Keeper">Wicket-Keeper</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select 
              className="form-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              <option value="All">All Statuses</option>
              <option value="Available">Available / Unsold</option>
              <option value="Sold">Sold</option>
              <option value="Captain">Captain</option>
              <option value="Unsold">Unsold Only</option>
            </select>
          </div>
        </div>
        
        {/* Helper counter text */}
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '1rem', fontWeight: 500 }}>
          Showing {filteredPlayers.length} of {players.length} players
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="glass-panel" style={{ padding: '1rem 1.5rem', borderColor: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem' }}>
          <ShieldAlert style={{ color: 'var(--danger)' }} />
          <span style={{ color: 'var(--danger)', fontWeight: 500 }}>{error}</span>
        </div>
      )}

      {/* Players Grid */}
      {(!hasMounted || isLoading) ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
          <RefreshCw className="animate-spin" size={36} style={{ margin: '0 auto 1rem', display: 'block', color: 'var(--primary)' }} />
          <span>Synchronizing with Excel Sheet...</span>
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', borderStyle: 'dashed' }}>
          <Users size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>No Players Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Try adjusting your search query or filters.</p>
        </div>
      ) : (
        <div className="card-grid" style={{ gap: '1.5rem' }}>
          {filteredPlayers.map((player, idx) => (
            <div 
              key={`${player.mobile}-${idx}`}
              className="glass-panel"
              style={{ 
                padding: '1.25rem', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'space-between',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-card)'
              }}
            >
              {/* Card Top: Photo & Basic Details */}
              <div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div 
                    onClick={() => window.location.href = `/players/${encodeURIComponent(player.uuid || player.mobile)}`}
                    style={{ 
                      width: '64px', 
                      height: '64px', 
                      borderRadius: '50%', 
                      overflow: 'hidden', 
                      border: '2px solid rgba(255, 255, 255, 0.1)', 
                      flexShrink: 0,
                      cursor: 'pointer'
                    }}
                  >
                    <ImageKitImage 
                      src={player.playerPhoto ? getDirectDriveUrl(player.playerPhoto) : 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200'} 
                      alt={player.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200';
                      }}
                    />
                  </div>
                  <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <h3 
                      onClick={() => window.location.href = `/players/${encodeURIComponent(player.uuid || player.mobile)}`}
                      style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', cursor: 'pointer', transition: 'color 0.2s' }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--primary)'}
                      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
                    >
                      {player.name}
                    </h3>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Smartphone size={12} />
                      <span>{player.mobile}</span>
                    </div>
                    <div style={{ marginTop: '0.15rem' }}>
                      <span className="badge" style={{ backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.5rem' }}>
                        {player.playingRole}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Admin Actions Only */}
              {isAdmin && (
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.75rem', marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <button
                    onClick={() => handleOpenEdit(player)}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.7rem',
                      borderColor: 'rgba(255,255,255,0.15)'
                    }}
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      </div>

      {/* Edit Player Modal */}
      {editingPlayer && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(8, 12, 20, 0.85)',
          backdropFilter: 'blur(10px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '2rem 1rem',
          overflowY: 'auto'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '550px',
            padding: '2rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            marginTop: '2rem',
            marginBottom: '2rem',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>Edit Player Profile</h2>
              <button 
                onClick={() => setEditingPlayer(null)} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.5rem' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="modal-form-grid">
                <div>
                  <label className="form-label">Player Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={editForm.name} 
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })} 
                    required 
                  />
                </div>
                <div>
                  <label className="form-label">Mobile Number</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={editForm.mobile} 
                    onChange={e => setEditForm({ ...editForm, mobile: e.target.value })} 
                    required 
                  />
                </div>
              </div>

              <div className="modal-form-grid">
                <div>
                  <label className="form-label">Playing Role</label>
                  <select 
                    className="form-input" 
                    value={editForm.playingRole} 
                    onChange={e => setEditForm({ ...editForm, playingRole: e.target.value })}
                  >
                    <option value="Batsman">Batsman</option>
                    <option value="Bowler">Bowler</option>
                    <option value="All-Rounder">All-Rounder</option>
                    <option value="Wicket-Keeper">Wicket-Keeper</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Playing As (e.g. Indian/Overseas)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={editForm.playingAs} 
                    onChange={e => setEditForm({ ...editForm, playingAs: e.target.value })} 
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Player Photo</label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input 
                    type="text" 
                    placeholder="Paste Photo URL or upload a file"
                    className="form-input" 
                    style={{ flex: 1, minWidth: '200px' }}
                    value={editForm.playerPhoto} 
                    onChange={e => setEditForm({ ...editForm, playerPhoto: e.target.value })} 
                  />
                  <div style={{ position: 'relative' }}>
                    <label className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.65rem 1rem', fontSize: '0.85rem' }}>
                      <span>{isUploadingImage ? 'Uploading...' : 'Upload Photo'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageUpload} 
                        disabled={isUploadingImage} 
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                      />
                    </label>
                  </div>
                </div>
                {editForm.playerPhoto && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <ImageKitImage src={getDirectDriveUrl(editForm.playerPhoto)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Image Preview</span>
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Auction & Status</h3>
                
                <div className="modal-form-grid" style={{ marginBottom: '1rem' }}>
                  <div>
                    <label className="form-label">Status</label>
                    <select 
                      className="form-input" 
                      value={editForm.status} 
                      onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                    >
                      <option value="">Available</option>
                      <option value="Sold">Sold</option>
                      <option value="Unsold">Unsold</option>
                      <option value="Captain">Captain</option>
                    </select>
                  </div>
                  
                  {(editForm.status === 'Sold' || editForm.status === 'Captain') && (
                    <div>
                      <label className="form-label">Assigned Team</label>
                      <select 
                        className="form-input" 
                        value={editForm.team} 
                        onChange={e => setEditForm({ ...editForm, team: e.target.value })}
                      >
                        <option value="">Select Team</option>
                        {teams.map(t => (
                          <option key={t.name} value={t.name}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {(editForm.status === 'Sold' || editForm.status === 'Captain') && (
                  <div style={{ maxWidth: '50%' }}>
                    <label className="form-label">Sold Price</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={editForm.soldPrice} 
                      onChange={e => setEditForm({ ...editForm, soldPrice: e.target.value })} 
                    />
                  </div>
                )}
              </div>

              <div className="modal-form-actions">
                <button type="button" onClick={() => setEditingPlayer(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="btn btn-primary">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </>
  );
}
