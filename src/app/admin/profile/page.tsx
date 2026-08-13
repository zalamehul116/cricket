'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, User, KeyRound, CheckCircle, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

export default function AdminProfilePage() {
  const router = useRouter();

  // Authentication & session state
  const [session, setSession] = useState<{ loggedIn: boolean; role?: 'admin' | 'team'; name?: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Form states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Form feedback states
  const [isSubmitLoading, setIsSubmitLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Authenticate session
  const checkSession = async () => {
    try {
      const res = await fetch(`/api/auth/session?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.role === 'admin') {
        setSession(data);
      } else {
        router.push('/login');
      }
    } catch (err) {
      console.error('Session verification failed:', err);
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Frontend validations
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All password fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and password confirmation do not match.');
      return;
    }

    if (newPassword.trim().length < 4) {
      setError('New password must be at least 4 characters long.');
      return;
    }

    setIsSubmitLoading(true);

    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      const data = await res.json();

      if (data.success) {
        setSuccess('Password updated successfully!');
        // Reset password fields
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(data.error || 'Failed to change password. Please check your current password.');
      }
    } catch (err) {
      console.error('Failed to change password:', err);
      setError('A network error occurred. Please try again.');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const isAdmin = session?.loggedIn && session?.role === 'admin';

  if (isLoading || !session || !isAdmin) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-secondary)' }}>
        <Shield className="animate-pulse" size={48} style={{ margin: '0 auto 1.5rem', color: 'var(--primary)' }} />
        <h3>Authenticating Administrator...</h3>
      </div>
    );
  }

  return (
    <div className="animate-slide-up" style={{ paddingBottom: '3rem', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header Bar */}
      <div className="page-header" style={{ marginBottom: '2.5rem' }}>
        <div className="page-header-with-back">
          <button 
            onClick={() => router.push('/auctions')}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem', flexShrink: 0 }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="page-title">Admin Profile</h1>
            <p className="page-subtitle" style={{ marginTop: 0 }}>
              Manage your administrator profile details and change password credentials.
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="glass-panel animate-fade-in" style={{ padding: '1rem 1.5rem', borderColor: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <AlertCircle style={{ color: 'var(--danger)' }} />
          <span style={{ color: 'var(--danger)', fontWeight: 500 }}>{error}</span>
        </div>
      )}
      {success && (
        <div className="glass-panel animate-fade-in" style={{ padding: '1rem 1.5rem', borderColor: 'var(--success)', background: 'rgba(16, 185, 129, 0.05)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <CheckCircle style={{ color: 'var(--success)' }} />
          <span style={{ color: 'var(--success)', fontWeight: 500 }}>{success}</span>
        </div>
      )}

      {/* Main Grid: Profile & Password Change */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        
        {/* Profile Card */}
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', height: 'fit-content' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={18} style={{ color: 'var(--primary)' }} />
            <span>Profile Details</span>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Username</span>
              <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>admin</strong>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Role</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
                <span className="badge badge-captain" style={{ margin: 0 }}>Administrator</span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Privilege Level</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>Full Control (Read/Write/Delete)</span>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Database Connection</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--success)', fontSize: '0.9rem', marginTop: '0.2rem', fontWeight: 500 }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }}></div>
                <span>Connected</span>
              </div>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <KeyRound size={18} style={{ color: 'var(--primary)' }} />
            <span>Change Password</span>
          </h2>

          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label className="form-label" style={{ marginBottom: '0.5rem' }}>Current Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  placeholder="Enter current password..."
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  required
                />
                <Lock size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>

            <div>
              <label className="form-label" style={{ marginBottom: '0.5rem' }}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  placeholder="Minimum 4 characters..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  required
                />
                <Lock size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>

            <div>
              <label className="form-label" style={{ marginBottom: '0.5rem' }}>Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  placeholder="Repeat new password..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  required
                />
                <Lock size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitLoading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontWeight: 700,
                justifyContent: 'center',
                gap: '0.5rem',
                marginTop: '0.5rem'
              }}
            >
              {isSubmitLoading ? (
                <>
                  <RefreshCw className="animate-spin" size={16} />
                  <span>Saving Password...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
