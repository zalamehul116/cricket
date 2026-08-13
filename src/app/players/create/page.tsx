'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus, ShieldAlert, CheckCircle, Smartphone, User, Image, Globe } from 'lucide-react';
import { getDirectDriveUrl } from '@/lib/utils';
import ImageKitImage from '@/components/ImageKitImage';

export default function CreatePlayerPage() {
  const router = useRouter();
  const [session, setSession] = useState<{ loggedIn: boolean; role?: 'admin' | 'team'; name?: string } | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    mobile: '',
    playingRole: 'Batsman',
    playingAs: 'Indian',
    playerPhoto: ''
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    
    setIsUploadingImage(true);
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
        setForm(prev => ({ ...prev, playerPhoto: data.url }));
        setSuccess('Photo uploaded successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to upload image');
      }
    } catch (err) {
      console.error(err);
      setError('Network error uploading image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data.success) {
          setSession(data);
        }
      } catch (err) {
        console.error('Error fetching session:', err);
      } finally {
        setIsLoadingSession(false);
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.name.trim() || !form.mobile.trim()) {
      setError('Player Name and Mobile Number are required.');
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ...form
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Player profile created successfully!');
        setForm({
          name: '',
          mobile: '',
          playingRole: 'Batsman',
          playingAs: 'Indian',
          playerPhoto: ''
        });
        setTimeout(() => {
          router.push('/players');
        }, 1500);
      } else {
        setError(data.error || 'Failed to create player profile.');
      }
    } catch (err) {
      console.error(err);
      setError('A network error occurred. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoadingSession) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-secondary)' }}>
        <span>Loading session...</span>
      </div>
    );
  }

  const isAdmin = session?.loggedIn && session?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="glass-panel animate-slide-up" style={{ maxWidth: '500px', margin: '4rem auto', padding: '3rem 2rem', textAlign: 'center', border: '1px solid var(--danger)' }}>
        <ShieldAlert size={48} style={{ color: 'var(--danger)', marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Access Denied</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          Only administrators have permission to create new player profiles.
        </p>
        <button onClick={() => router.push('/players')} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowLeft size={16} />
          <span>Back to Players</span>
        </button>
      </div>
    );
  }

  return (
    <div className="animate-slide-up" style={{ maxWidth: '650px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Back Button */}
      <button 
        onClick={() => router.push('/players')} 
        className="btn btn-secondary" 
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <ArrowLeft size={16} />
        <span>Back to Players</span>
      </button>

      {/* Main Form Panel */}
      <div className="glass-panel panel-padding-lg" style={{ border: '1px solid var(--border-color-glow)', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
          <div style={{ backgroundColor: 'var(--primary-glow)', padding: '0.6rem', borderRadius: '10px' }}>
            <UserPlus size={24} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, background: 'linear-gradient(135deg, #fff 0%, #f59e0b 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Create Player Profile
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.15rem' }}>
              Manually register a single player in the tournament player pool.
            </p>
          </div>
        </div>

        {/* Success/Error Alerts */}
        {error && (
          <div style={{ padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', backgroundColor: 'rgba(239, 68, 68, 0.05)', color: 'var(--danger)', fontWeight: 500, fontSize: '0.9rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div style={{ padding: '1rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', backgroundColor: 'rgba(16, 185, 129, 0.05)', color: 'var(--success)', fontWeight: 500, fontSize: '0.9rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={18} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }} className="form-grid-mobile">
            {/* Player Name */}
            <div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                <User size={14} style={{ color: 'var(--primary)' }} />
                <span>Player Name</span>
              </label>
              <input 
                type="text" 
                placeholder="e.g. John Doe"
                className="form-input" 
                value={form.name} 
                onChange={e => setForm({ ...form, name: e.target.value })} 
                required 
              />
            </div>

            {/* Mobile Number */}
            <div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                <Smartphone size={14} style={{ color: 'var(--primary)' }} />
                <span>Mobile Number</span>
              </label>
              <input 
                type="text" 
                placeholder="e.g. 9876543210"
                className="form-input" 
                value={form.mobile} 
                onChange={e => setForm({ ...form, mobile: e.target.value })} 
                required 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }} className="form-grid-mobile">
            {/* Playing Role */}
            <div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                <span>Playing Role</span>
              </label>
              <select 
                className="form-input" 
                style={{ cursor: 'pointer' }}
                value={form.playingRole} 
                onChange={e => setForm({ ...form, playingRole: e.target.value })}
              >
                <option value="Batsman">Batsman</option>
                <option value="Bowler">Bowler</option>
                <option value="All-Rounder">All-Rounder</option>
                <option value="Wicket-Keeper">Wicket-Keeper</option>
              </select>
            </div>

            {/* Playing As */}
            <div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                <Globe size={14} style={{ color: 'var(--primary)' }} />
                <span>Playing As</span>
              </label>
              <input 
                type="text" 
                placeholder="e.g. Indian/Overseas"
                className="form-input" 
                value={form.playingAs} 
                onChange={e => setForm({ ...form, playingAs: e.target.value })} 
              />
            </div>
          </div>

          {/* Photo URL & Upload Option */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
              <Image size={14} style={{ color: 'var(--primary)' }} />
              <span>Player Photo</span>
            </label>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                placeholder="Paste Photo URL or upload a file"
                className="form-input" 
                style={{ flex: 1, minWidth: '200px' }}
                value={form.playerPhoto} 
                onChange={e => setForm({ ...form, playerPhoto: e.target.value })} 
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
            {form.playerPhoto && (
              <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <ImageKitImage src={getDirectDriveUrl(form.playerPhoto)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Image Preview</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="modal-form-actions">
            <button 
              type="button" 
              onClick={() => router.push('/players')} 
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isCreating} 
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', minWidth: '140px', justifyContent: 'center' }}
            >
              <span>{isCreating ? 'Registering...' : 'Register Player'}</span>
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
