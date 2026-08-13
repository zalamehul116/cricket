import { NextResponse } from 'next/server';
import { getDbPlayers, updateDbPlayer, getDbTeams, updateDbTeamCaptain, updateDbTeamBudget } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { teamName, playerMobile, auctionName, budget } = body;
    
    if (!teamName) {
      return NextResponse.json({ success: false, error: 'Team name is required' }, { status: 400 });
    }

    if (auctionName && budget !== undefined) {
      await updateDbTeamBudget(teamName, auctionName, Number(budget));
    }
    
    const players = await getDbPlayers(auctionName || undefined);
    const teams = await getDbTeams(auctionName || undefined);
    
    // Find team
    const team = teams.find(t => t.name === teamName);
    if (!team) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });
    }
    
    // If we are clearing the captain
    if (!playerMobile) {
      const currentCap = players.find(p => p.team === teamName && p.status === 'Captain');
      if (currentCap) {
        await updateDbPlayer(currentCap.mobile, '', '', '', auctionName || undefined);
      }
      
      if (team.captainMobile === (currentCap?.mobile || '')) {
        await updateDbTeamCaptain(teamName, '', '');
      }
      return NextResponse.json({ success: true, message: 'Captain removed successfully' });
    }
    
    // Find new captain
    const player = players.find(p => p.mobile === playerMobile);
    if (!player) {
      return NextResponse.json({ success: false, error: 'Player not found in this auction pool' }, { status: 404 });
    }
    
    // If player is already on another team in this auction
    if (player.team && player.team !== teamName) {
      return NextResponse.json({
        success: false,
        error: `Player is already assigned to team: ${player.team}`
      }, { status: 400 });
    }
    
    // Check if there was an old captain for this team in this auction and clear them
    const oldCap = players.find(p => p.team === teamName && p.status === 'Captain');
    if (oldCap && oldCap.mobile !== playerMobile) {
      await updateDbPlayer(oldCap.mobile, '', '', '', auctionName || undefined);
    }
    
    // Update player status in DB inside this auction
    await updateDbPlayer(playerMobile, 'Captain', teamName, 0, auctionName || undefined);
    
    // Update team captain info in DB
    await updateDbTeamCaptain(teamName, player.name, player.mobile);
    
    return NextResponse.json({
      success: true,
      message: 'Captain assigned successfully',
      data: {
        team: {
          ...team,
          captain: player.name,
          captainMobile: player.mobile
        },
        player: {
          ...player,
          status: 'Captain',
          team: teamName,
          soldPrice: 0
        }
      }
    });
  } catch (error: any) {
    console.error('Error assigning captain:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
