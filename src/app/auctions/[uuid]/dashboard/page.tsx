'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { Player, Team } from '@/lib/excel';
import { getDirectDriveUrl, formatCurrency } from '@/lib/utils';
import ImageKitImage from '@/components/ImageKitImage';
import {
  Users, Trophy, CheckCircle, XCircle, AlertCircle,
  TrendingUp, Coins, ShieldAlert, Award, Search, RefreshCw,
  ArrowLeft, Crown, DollarSign, ListFilter, Sparkles, Download
} from 'lucide-react';

export default function AuctionDashboardPage({ params }: { params: Promise<{ uuid: string }> }) {
  const resolvedParams = use(params);
  const auctionUuid = decodeURIComponent(resolvedParams.uuid);
  const router = useRouter();

  // Data state
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeAuction, setActiveAuction] = useState<any | null>(null);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [teamFilter, setTeamFilter] = useState<string>('All');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // UI Loaders & Feedback
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [exportingTeam, setExportingTeam] = useState<string | null>(null);

  // Fetch auction data, teams and players
  const fetchData = useCallback(async (showIndicator = false) => {
    if (showIndicator) setIsRefreshing(true);
    try {
      const [resPlayers, resTeams, resAuctions] = await Promise.all([
        fetch(`/api/players?auctionName=${encodeURIComponent(auctionUuid)}&t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/teams?auctionName=${encodeURIComponent(auctionUuid)}&t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/auction/list?t=${Date.now()}`, { cache: 'no-store' })
      ]);

      const dataPlayers = await resPlayers.json();
      const dataTeams = await resTeams.json();
      const dataAuctions = await resAuctions.json();

      if (dataPlayers.success && dataTeams.success && dataAuctions.success) {
        setPlayers(dataPlayers.data || []);
        setTeams(dataTeams.data || []);

        const roomAuction = dataAuctions.auctions.find(
          (a: any) => a.uuid === auctionUuid || a.name.toLowerCase() === auctionUuid.toLowerCase()
        );
        setActiveAuction(roomAuction || null);
        setError(null);
      } else {
        setError('Failed to fetch some details.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while loading dashboard data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [auctionUuid]);

  // Load data on mount and poll every 5 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Calculations for overall summary statistics
  const totalPlayers = players.length;
  const soldPlayers = players.filter(p => p.status === 'Sold' || p.status === 'Captain');
  const soldCount = soldPlayers.length;
  const unsoldCount = players.filter(p => p.status === 'Unsold').length;
  const availableCount = totalPlayers - soldCount - unsoldCount;

  // Filter teams list specifically to those participating in this auction
  const displayTeams = activeAuction
    ? teams.filter(t => activeAuction.teams.includes(t.name))
    : [];

  const totalTeamsCount = displayTeams.length;

  // Calculate highest-priced player(s)
  const soldPlayersWithPrice = players.filter(
    p => (p.status === 'Sold' || p.status === 'Captain') && p.soldPrice !== '' && p.soldPrice !== undefined
  );

  let highestPricePlayers: Player[] = [];
  let maxPrice = 0;

  if (soldPlayersWithPrice.length > 0) {
    maxPrice = Math.max(...soldPlayersWithPrice.map(p => Number(p.soldPrice || 0)));
    highestPricePlayers = soldPlayersWithPrice.filter(p => Number(p.soldPrice || 0) === maxPrice);
  }

  // Calculate team stats helper
  const getTeamStats = (teamName: string) => {
    const team = teams.find(t => t.name === teamName);
    const initialBudget = team ? team.budget : 10000000;
    const teamPlayers = players.filter(p => p.team === teamName);
    const spent = teamPlayers.reduce((sum, p) => sum + (p.soldPrice ? Number(p.soldPrice) : 0), 0);
    const remaining = initialBudget - spent;

    return {
      initialBudget,
      spent,
      remaining,
      playerCount: teamPlayers.length,
      logo: team?.logo || '',
      captain: team?.captain || 'Not Assigned',
      owner: team?.owner || 'Not Set'
    };
  };

  // Total tournament spent
  const totalSpent = soldPlayers.reduce((sum, p) => sum + (p.soldPrice ? Number(p.soldPrice) : 0), 0);
  const totalCombinedBudget = displayTeams.reduce((sum, t) => sum + Number(t.budget || 10000000), 0);

  // Filtered Players list for general explorer tab
  const filteredPlayers = players.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.mobile.includes(searchQuery);
    const matchesTeam = teamFilter === 'All' || p.team === teamFilter || (teamFilter === 'Unassigned' && !p.team);
    const matchesRole = roleFilter === 'All' || p.playingRole === roleFilter;
    const matchesStatus = statusFilter === 'All' || 
                          (statusFilter === 'Sold' && (p.status === 'Sold' || p.status === 'Captain')) ||
                          (statusFilter === 'Unsold' && p.status === 'Unsold') ||
                          (statusFilter === 'Available' && p.status === '');
    
    return matchesSearch && matchesTeam && matchesRole && matchesStatus;
  });

  // Regular export: CSV Download
  const exportTeamCSV = (teamName: string) => {
    const teamPlayers = players.filter(p => p.team === teamName);
    const stats = getTeamStats(teamName);
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `Team Name,${teamName}\n`;
    csvContent += `Owner,${stats.owner}\n`;
    csvContent += `Captain,${stats.captain}\n`;
    csvContent += `Total Budget,${stats.initialBudget}\n`;
    csvContent += `Budget Spent,${stats.spent}\n`;
    csvContent += `Budget Remaining,${stats.remaining}\n\n`;
    csvContent += "Player Name,Mobile,Playing Role,Playing As,Status,Sold Price\n";
    
    teamPlayers.forEach(p => {
      const row = [
        p.name,
        p.mobile,
        p.playingRole,
        p.playingAs,
        p.status || 'Sold',
        p.soldPrice || 0
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvContent += row + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${teamName.replace(/\s+/g, '_')}_Roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export with Photos: Printer Window trigger
  const printTeamPoster = (teamName: string) => {
    const teamPlayers = players.filter(p => p.team === teamName);
    const stats = getTeamStats(teamName);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to export the team roster.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${teamName} - Squad Poster</title>
          <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            body {
              background-color: #080c14;
              color: #f3f4f6;
              font-family: 'Plus Jakarta Sans', sans-serif;
              margin: 0;
              padding: 30px;
              display: flex;
              justify-content: center;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .poster {
              width: 100%;
              max-width: 850px;
              background: linear-gradient(185deg, #111827 0%, #080c14 100%);
              border: 3px solid #f59e0b;
              box-shadow: 0 12px 40px rgba(0,0,0,0.6);
              border-radius: 24px;
              padding: 40px;
              box-sizing: border-box;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid rgba(245, 158, 11, 0.3);
              padding-bottom: 24px;
              margin-bottom: 30px;
              flex-wrap: wrap;
              gap: 20px;
            }
            .team-info {
              display: flex;
              align-items: center;
              gap: 20px;
            }
            .logo {
              width: 75px;
              height: 75px;
              border-radius: 14px;
              object-fit: cover;
              border: 2px solid #f59e0b;
            }
            .logo-fallback {
              width: 75px;
              height: 75px;
              border-radius: 14px;
              background: rgba(245, 158, 11, 0.15);
              color: #f59e0b;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 800;
              font-size: 32px;
              border: 2px solid #f59e0b;
              font-family: 'Outfit', sans-serif;
            }
            .team-name {
              font-family: 'Outfit', sans-serif;
              font-size: 32px;
              font-weight: 800;
              margin: 0;
              color: #f3f4f6;
              letter-spacing: -0.02em;
            }
            .owner-captain {
              font-size: 14px;
              color: #9ca3af;
              margin-top: 6px;
            }
            .owner-captain strong {
              color: #f3f4f6;
            }
            .stats {
              text-align: right;
            }
            .budget-left {
              font-size: 22px;
              font-weight: 800;
              color: #10b981;
            }
            .budget-spent {
              font-size: 13px;
              color: #9ca3af;
              margin-top: 6px;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
              gap: 20px;
            }
            .player-card {
              background: rgba(255,255,255,0.02);
              border: 1px solid rgba(255,255,255,0.06);
              border-radius: 16px;
              padding: 16px;
              display: flex;
              align-items: center;
              gap: 16px;
            }
            .player-photo {
              width: 56px;
              height: 56px;
              border-radius: 50%;
              object-fit: cover;
              border: 2px solid rgba(255,255,255,0.15);
            }
            .player-details {
              flex: 1;
              min-width: 0;
            }
            .player-name {
              font-weight: 700;
              font-size: 15px;
              color: #f3f4f6;
              margin: 0;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .player-role {
              font-size: 12px;
              color: #9ca3af;
              margin-top: 4px;
            }
            .player-price {
              font-size: 14px;
              font-weight: 800;
              color: #10b981;
              margin-top: 6px;
            }
            .footer {
              margin-top: 40px;
              border-top: 1px solid rgba(255,255,255,0.05);
              padding-top: 20px;
              text-align: center;
              font-size: 12px;
              color: #6b7280;
            }
            @media print {
              body {
                background-color: #080c14 !important;
                padding: 0;
              }
              .poster {
                box-shadow: none !important;
                border: 3px solid #f59e0b !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="poster">
            <div class="header">
              <div class="team-info">
                ${stats.logo ? `<img class="logo" src="${stats.logo}" alt="${teamName}">` : `<div class="logo-fallback">${teamName.charAt(0)}</div>`}
                <div>
                  <h1 class="team-name">${teamName}</h1>
                  <div class="owner-captain">
                    Owner: <strong>${stats.owner}</strong> &bull; Captain: <strong>${stats.captain}</strong>
                  </div>
                </div>
              </div>
              <div class="stats">
                <div class="budget-left">Left: ${formatCurrency(stats.remaining)}</div>
                <div class="budget-spent">Spent: ${formatCurrency(stats.spent)}</div>
              </div>
            </div>
            <div class="grid">
              ${teamPlayers.map(p => `
                <div class="player-card">
                  <img class="player-photo" src="${getDirectDriveUrl(p.playerPhoto)}" onError="this.src='https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100'" alt="${p.name}">
                  <div class="player-details">
                    <h4 class="player-name">${p.name}</h4>
                    <div class="player-role">${p.playingRole} &bull; ${p.playingAs}</div>
                    <div class="player-price">${formatCurrency(Number(p.soldPrice || 0))}</div>
                  </div>
                </div>
              `).join('')}
            </div>
            <div class="footer">
              Generated by Oction Platform &bull; ${activeAuction.name}
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 1200);
            }
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '2rem' }} className="animate-pulse">
        <div style={{ height: '4rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <div style={{ height: '8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }} />
          <div style={{ height: '8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }} />
          <div style={{ height: '8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }} />
          <div style={{ height: '8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }} />
        </div>
        <div style={{ height: '20rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px' }} />
      </div>
    );
  }

  if (!activeAuction) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1.5rem', textAlign: 'center' }}>
        <ShieldAlert size={64} style={{ color: 'var(--warning)', filter: 'drop-shadow(0 0 10px rgba(245, 158, 11, 0.4))' }} />
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>Auction Round Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', maxWidth: '400px' }}>
            We could not locate data for auction "{auctionUuid}".
          </p>
        </div>
        <button onClick={() => router.push('/auctions')} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Back to Auctions
        </button>
      </div>
    );
  }

  return (
    <div className="main-content animate-slide-up" style={{ paddingBottom: '4rem' }}>
      <style jsx>{`
        @media (min-width: 480px) {
          .responsive-align-left {
            text-align: left !important;
          }
          .responsive-justify-start {
            justify-content: flex-start !important;
          }
        }
      `}</style>
      {/* Top Header */}
      <div className="page-header" style={{ marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push(`/auctions/${encodeURIComponent(auctionUuid)}`)}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.8rem', flexShrink: 0 }}
          >
            <ArrowLeft size={16} />
            <span>Auction Room</span>
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge badge-captain" style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>
                {activeAuction.status}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Dashboard</span>
            </div>
            <h1 className="page-title" style={{ marginTop: '0.25rem' }}>
              {activeAuction.name} Analysis
            </h1>
          </div>
        </div>

        <button
          onClick={() => fetchData(true)}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          disabled={isRefreshing}
        >
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          <span>Sync Dashboard</span>
        </button>
      </div>

      {error && (
        <div className="glass-panel" style={{ padding: '1rem 1.5rem', borderColor: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <AlertCircle style={{ color: 'var(--danger)' }} />
          <span style={{ color: 'var(--danger)', fontWeight: 500 }}>{error}</span>
        </div>
      )}

      {/* Analytical Quick Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
        
        {/* Teams Count Card */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '0.75rem', borderRadius: '12px', color: 'var(--primary)' }}>
            <Trophy size={28} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Total Teams</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{totalTeamsCount}</div>
          </div>
        </div>

        {/* Players Count Card */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.75rem', borderRadius: '12px', color: 'var(--secondary)' }}>
            <Users size={28} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Assigned Players</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{totalPlayers}</div>
          </div>
        </div>

        {/* Sold Count Card */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '12px', color: 'var(--success)' }}>
            <CheckCircle size={28} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Sold Players</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success)' }}>
              {soldCount} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>({Math.round((soldCount / (totalPlayers || 1)) * 100)}%)</span>
            </div>
          </div>
        </div>

        {/* Remaining Pools Card */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
          <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '0.75rem', borderRadius: '12px', color: 'var(--info)' }}>
            <TrendingUp size={28} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Available / Unsold</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--info)' }}>
              {availableCount} / {unsoldCount}
            </div>
          </div>
        </div>

        {/* Combined Budget spent */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '12px', color: 'var(--text-primary)' }}>
            <Coins size={28} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Total Spent / Budget</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>
              {formatCurrency(totalSpent)}
              <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                of {formatCurrency(totalCombinedBudget)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Highlight Section: Highest-Priced Player */}
      <div className="glass-panel glass-panel-glow pulse-glow-border" style={{ padding: '2rem', marginBottom: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'radial-gradient(ellipse at top right, rgba(245, 158, 11, 0.08) 0%, rgba(8, 12, 20, 0.5) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Crown size={22} style={{ color: 'var(--primary)' }} /> Highest Bid Player Highlight
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Sparkles size={14} style={{ color: 'var(--primary)' }} />
            Premium Value
          </span>
        </div>

        {highestPricePlayers.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No players have been drafted in this auction yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'center' }}>
            {highestPricePlayers.map((player) => {
              const stats = player.team ? getTeamStats(player.team) : null;
              return (
                <div key={player.mobile} style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Photo Frame */}
                  <div style={{ width: '130px', height: '130px', borderRadius: '16px', overflow: 'hidden', border: '3px solid var(--primary)', boxShadow: '0 0 25px rgba(245, 158, 11, 0.35)', flexShrink: 0, margin: '0 auto' }}>
                    <ImageKitImage
                      src={getDirectDriveUrl(player.playerPhoto)}
                      alt={player.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=300';
                      }}
                    />
                  </div>

                  {/* Player info */}
                  <div style={{ flex: 1, minWidth: '180px', textAlign: 'center' }} className="responsive-align-left">
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem', justifyContent: 'center' }} className="responsive-justify-start">
                      <span className="badge badge-sold" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>{player.playingRole}</span>
                      <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', fontSize: '0.65rem' }}>{player.playingAs}</span>
                    </div>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{player.name}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Mobile: {player.mobile}</p>
                    
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'center' }} className="responsive-justify-start">
                      <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Sold For:</span>
                      <strong style={{ fontSize: '1.4rem', color: 'var(--success)', fontWeight: 800 }}>{formatCurrency(Number(player.soldPrice || 0))}</strong>
                    </div>
                  </div>

                  {/* Team Card */}
                  {player.team && (
                    <div className="glass-panel" style={{ padding: '1rem 1.25rem', minWidth: '220px', flex: 1, background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Drafted By</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 850, color: 'var(--primary)', marginBottom: '0.5rem' }}>{player.team}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Owner: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{stats?.owner}</span></div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>Captain: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{stats?.captain}</span></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Board: Team-Wise Roster Grid */}
      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Trophy size={24} style={{ color: 'var(--primary)' }} /> Team Wise Roster & Budget Standings
      </h2>

      {displayTeams.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '3rem' }}>
          No participating teams registered for this auction round.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '4rem' }}>
          {displayTeams.map((team) => {
            const stats = getTeamStats(team.name);
            const teamPlayers = players.filter(p => p.team === team.name);
            const budgetPercent = Math.min(100, Math.round((stats.spent / (stats.initialBudget || 10000000)) * 100));

            return (
              <div 
                key={team.name} 
                className="glass-panel" 
                style={{ 
                  padding: '1.75rem', 
                  border: '1px solid var(--border-color)',
                  background: 'linear-gradient(185deg, var(--bg-card) 0%, rgba(8, 12, 20, 0.4) 100%)'
                }}
              >
                {/* Team Info Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {team.logo ? (
                      <div style={{ width: '56px', height: '56px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                        <ImageKitImage
                          src={getDirectDriveUrl(team.logo)}
                          alt={team.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?w=100';
                          }}
                        />
                      </div>
                    ) : (
                      <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 800, flexShrink: 0 }}>
                        {team.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{team.name}</h3>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span>Owner: <strong style={{ color: 'var(--text-primary)' }}>{stats.owner}</strong></span>
                        <span>Captain: <strong style={{ color: 'var(--primary)' }}>{stats.captain}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Budget Indicators */}
                  <div style={{ width: '100%', maxWidth: '340px', flex: '1 1 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Budget Spent: {budgetPercent}%</span>
                      <span style={{ color: 'var(--success)' }}>Left: {formatCurrency(stats.remaining)}</span>
                    </div>
                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          width: `${budgetPercent}%`, 
                          height: '100%', 
                          background: budgetPercent >= 90 ? 'var(--danger)' : budgetPercent >= 70 ? 'var(--warning)' : 'var(--success)',
                          borderRadius: '999px',
                          transition: 'width 0.5s ease-out'
                        }} 
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      <span>Spent: {formatCurrency(stats.spent)}</span>
                      <span>Total: {formatCurrency(stats.initialBudget)}</span>
                    </div>
                  </div>
                </div>

                {/* Team Export Actions */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => exportTeamCSV(team.name)}
                    className="btn btn-secondary"
                    style={{ 
                      padding: '0.4rem 0.85rem', 
                      fontSize: '0.75rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.35rem', 
                      background: 'rgba(255,255,255,0.02)',
                      flexGrow: 1,
                      justifyContent: 'center',
                      maxWidth: '220px'
                    }}
                  >
                    <Download size={13} style={{ color: 'var(--success)' }} />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={() => setExportingTeam(team.name)}
                    className="btn btn-secondary"
                    style={{ 
                      padding: '0.4rem 0.85rem', 
                      fontSize: '0.75rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.35rem', 
                      borderColor: 'var(--primary)', 
                      color: 'var(--primary)',
                      background: 'rgba(245, 158, 11, 0.02)',
                      flexGrow: 1,
                      justifyContent: 'center',
                      maxWidth: '220px'
                    }}
                  >
                    <Award size={13} />
                    <span>Export Poster (Photos)</span>
                  </button>
                </div>

                {/* Team Roster Grid */}
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  Acquired Players ({teamPlayers.length})
                </h4>

                {teamPlayers.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.1)', borderRadius: '10px', fontSize: '0.8rem', fontStyle: 'italic' }}>
                    No players acquired yet.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                    {teamPlayers.map((player) => (
                      <div 
                        key={player.mobile}
                        className="glass-panel" 
                        style={{ 
                          padding: '0.75rem 1rem', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.75rem',
                          background: 'rgba(0,0,0,0.15)',
                          border: '1px solid rgba(255,255,255,0.03)'
                        }}
                      >
                        {/* Player Mini Photo */}
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.15)', flexShrink: 0 }}>
                          <ImageKitImage
                            src={getDirectDriveUrl(player.playerPhoto)}
                            alt={player.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100';
                            }}
                          />
                        </div>
                        
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {player.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                            {player.playingRole} • {player.playingAs}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--success)' }}>
                            {formatCurrency(Number(player.soldPrice || 50000))}
                          </div>
                          <span className="badge badge-sold" style={{ fontSize: '0.55rem', padding: '0.05rem 0.25rem', marginTop: '0.15rem' }}>
                            {player.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Explorer / Full Player database inside this Auction */}
      <div className="glass-panel" style={{ padding: '1.75rem', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ListFilter size={20} style={{ color: 'var(--primary)' }} /> Player Pool Explorer ({filteredPlayers.length} / {totalPlayers})
          </h3>
        </div>

        {/* Filter Toolbar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search player name or mobile..."
              className="form-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2rem', fontSize: '0.85rem' }}
            />
          </div>

          {/* Team Filter */}
          <select
            className="form-input"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            style={{ cursor: 'pointer', fontSize: '0.85rem' }}
          >
            <option value="All">All Teams</option>
            <option value="Unassigned">Unassigned (Available/Unsold)</option>
            {displayTeams.map(t => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>

          {/* Role Filter */}
          <select
            className="form-input"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{ cursor: 'pointer', fontSize: '0.85rem' }}
          >
            <option value="All">All Playing Roles</option>
            <option value="Batsman">Batsman</option>
            <option value="Bowler">Bowler</option>
            <option value="All Rounder">All Rounder</option>
            <option value="Wicket Keeper">Wicket Keeper</option>
          </select>

          {/* Status Filter */}
          <select
            className="form-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ cursor: 'pointer', fontSize: '0.85rem' }}
          >
            <option value="All">All Statuses</option>
            <option value="Available">Available Only</option>
            <option value="Sold">Sold Only</option>
            <option value="Unsold">Unsold Only</option>
          </select>
        </div>

        {/* Players Data Table */}
        {filteredPlayers.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No players match the search or filter criteria.
          </div>
        ) : (
          <div className="data-table-wrap" style={{ border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 650, fontSize: '0.85rem' }}>Player</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 650, fontSize: '0.85rem' }}>Playing Role</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 650, fontSize: '0.85rem' }}>Playing As</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 650, fontSize: '0.85rem' }}>Status</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 650, fontSize: '0.85rem' }}>Drafted Team</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 650, fontSize: '0.85rem' }}>Sold Price</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((p) => {
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
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
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>{p.name}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Mob: {p.mobile}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.playingRole}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.playingAs}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {isSold && <span className="badge badge-sold" style={{ fontSize: '0.65rem' }}>Sold</span>}
                        {isUnsold && <span className="badge badge-unsold" style={{ fontSize: '0.65rem' }}>Unsold</span>}
                        {isAvailable && <span className="badge badge-pending" style={{ fontSize: '0.65rem' }}>Available</span>}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: isSold ? 'var(--primary)' : 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {p.team || '-'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: isSold ? 'var(--success)' : 'var(--text-secondary)', fontSize: '0.85rem' }}>
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

      {/* Roster Poster Preview Modal */}
      {exportingTeam && (
        <div 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100vw', 
            height: '100vh', 
            background: 'rgba(0, 0, 0, 0.85)', 
            backdropFilter: 'blur(12px)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1000, 
            padding: '2rem 1rem' 
          }} 
          className="animate-fade-in"
        >
          <div 
            className="glass-panel" 
            style={{ 
              maxWidth: '850px', 
              width: '100%', 
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '2rem', 
              border: '2px solid var(--primary)', 
              position: 'relative', 
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Award size={22} /> Export {exportingTeam} Squad
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                  Preview and download the squad poster or CSV file.
                </p>
              </div>
              <button 
                onClick={() => setExportingTeam(null)} 
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
              >
                Close
              </button>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => printTeamPoster(exportingTeam)}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '180px' }}
              >
                <Award size={16} />
                <span>Print Poster / Save PDF</span>
              </button>
              <button
                onClick={() => exportTeamCSV(exportingTeam)}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '180px' }}
              >
                <Download size={16} style={{ color: 'var(--success)' }} />
                <span>Download Roster CSV</span>
              </button>
            </div>

            {/* Poster Preview */}
            <div 
              style={{ 
                background: 'linear-gradient(185deg, #111827 0%, #080c14 100%)', 
                border: '1px solid var(--primary)', 
                borderRadius: '16px', 
                padding: '1.5rem',
                maxHeight: '400px',
                overflowY: 'auto'
              }}
            >
              {(() => {
                const stats = getTeamStats(exportingTeam);
                const teamPlayers = players.filter(p => p.team === exportingTeam);
                
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(245, 158, 11, 0.3)', paddingBottom: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {stats.logo ? (
                          <div style={{ width: '40px', height: '40px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                            <ImageKitImage
                              src={getDirectDriveUrl(stats.logo)}
                              alt={exportingTeam}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                        ) : (
                          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>
                            {exportingTeam.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>{exportingTeam}</h3>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Owner: {stats.owner} &bull; Captain: {stats.captain}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--success)' }}>Left: {formatCurrency(stats.remaining)}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Spent: {formatCurrency(stats.spent)}</div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                      {teamPlayers.map((p) => (
                        <div 
                          key={p.mobile}
                          style={{ 
                            background: 'rgba(255,255,255,0.02)', 
                            border: '1px solid rgba(255,255,255,0.06)', 
                            borderRadius: '8px', 
                            padding: '0.5rem 0.75rem', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem' 
                          }}
                        >
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                            <ImageKitImage
                              src={getDirectDriveUrl(p.playerPhoto)}
                              alt={p.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100';
                              }}
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{p.playingRole}</div>
                          </div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--success)', flexShrink: 0 }}>
                            {formatCurrency(Number(p.soldPrice || 0))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
