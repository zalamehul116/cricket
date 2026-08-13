'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Users, Lock, LogIn, ChevronRight } from 'lucide-react';

export default function LoginPage() {
  const [role, setRole] = useState<'admin' | 'team'>('team');
  const [password, setPassword] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [passcode, setPasscode] = useState('');
  const [teams, setTeams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Fetch available teams
    const fetchTeams = async () => {
      try {
        const res = await fetch('/api/teams');
        const data = await res.json();
        if (data.success) {
          setTeams(data.data || []);
        }
      } catch (err) {
        console.error('Error fetching teams for login:', err);
      }
    };
    fetchTeams();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload = role === 'admin' 
        ? { role, password }
        : { role, teamName: selectedTeam, passcode };

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.success) {
        if (data.role === 'admin') {
          router.push('/');
        } else {
          router.push('/team-dashboard');
        }
        // Force router refresh
        router.refresh();
      } else {
        setError(data.error || 'Login failed. Please check credentials.');
      }
    } catch (err) {
      console.error(err);
      setError('A network error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedTeamObj = teams.find(t => t.name === selectedTeam);
  const hasPasscode = selectedTeamObj ? !!selectedTeamObj.passcode : true;

  return (
    <div className="login-wrapper animate-slide-up">
      <div className="glass-panel login-panel" style={{
        borderRadius: '16px',
        border: '1px solid var(--border-color-glow)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            padding: '1rem',
            borderRadius: '50%',
            background: role === 'admin' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(6, 182, 212, 0.1)',
            color: role === 'admin' ? 'var(--primary)' : 'var(--info)',
            marginBottom: '1rem',
            transition: 'all 0.3s ease'
          }}>
            {role === 'admin' ? <ShieldAlert size={32} /> : <Users size={32} />}
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Cricket Auction Portal
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Please select your role and sign in to continue
          </p>
        </div>

        {/* Role Toggle Selector */}
        <div style={{
          display: 'flex',
          background: 'rgba(0,0,0,0.2)',
          padding: '0.25rem',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          marginBottom: '1.5rem'
        }}>
          <button
            type="button"
            onClick={() => { setRole('team'); setError(null); }}
            style={{
              flex: 1,
              padding: '0.6rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: role === 'team' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
              color: role === 'team' ? 'var(--info)' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <Users size={16} />
            <span>Team Login</span>
          </button>
          <button
            type="button"
            onClick={() => { setRole('admin'); setError(null); }}
            style={{
              flex: 1,
              padding: '0.6rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: role === 'admin' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
              color: role === 'admin' ? 'var(--primary)' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <ShieldAlert size={16} />
            <span>Admin Login</span>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            color: 'var(--danger)',
            fontSize: '0.8rem',
            fontWeight: 500,
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {role === 'admin' ? (
            <div>
              <label className="form-label" style={{ marginBottom: '0.5rem' }}>Admin Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  placeholder="Enter administrator password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  required
                />
                <Lock size={16} style={{
                  position: 'absolute',
                  left: '0.9rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} />
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="form-label" style={{ marginBottom: '0.5rem' }}>Select Team</label>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="form-input"
                  required
                >
                  <option value="">-- Choose registered team --</option>
                  {teams.map(t => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="form-label" style={{ marginBottom: '0.5rem' }}>
                  Team Passcode
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    placeholder="Enter team login passcode..."
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: '2.5rem' }}
                    required
                  />
                  <Lock size={16} style={{
                    position: 'absolute',
                    left: '0.9rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)'
                  }} />
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={isLoading || (role === 'team' && !selectedTeam)}
            className={`btn ${role === 'admin' ? 'btn-primary' : 'btn-primary'}`}
            style={{
              padding: '0.8rem',
              fontSize: '0.9rem',
              fontWeight: 700,
              marginTop: '0.5rem',
              justifyContent: 'center',
              gap: '0.5rem',
              background: role === 'admin' 
                ? 'linear-gradient(135deg, var(--primary) 0%, #d97706 100%)' 
                : 'linear-gradient(135deg, var(--info) 0%, #0891b2 100%)'
            }}
          >
            {isLoading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In</span>
                <LogIn size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
