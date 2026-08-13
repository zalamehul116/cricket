import { NextResponse } from 'next/server';
import { getDbPlayers, getDbPlayersNotInAuction, getDbPlayerByMobile, updateDbPlayer, updateFullDbPlayer, updatePlayerAuction, removePlayerFromAuction, addDbPlayer, getPlayerAuctionHistory } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const auctionName = searchParams.get('auctionName') || undefined;
    const pool = searchParams.get('pool') || undefined;
    const mobile = searchParams.get('mobile') || undefined;

    let players;
    if (auctionName && pool === 'available') {
      players = await getDbPlayersNotInAuction(auctionName);
    } else {
      players = await getDbPlayers(auctionName);
    }
    
    if (mobile) {
      const player = players.find(p => p.mobile === mobile);
      if (!player) {
        return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
      }
      const history = await getPlayerAuctionHistory(mobile);
      return NextResponse.json({ success: true, data: { ...player, history } });
    }
    
    return NextResponse.json({ success: true, data: players });
  } catch (error: any) {
    console.error('Error fetching players:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { playerMobile, playerMobiles, status, team, soldPrice, auctionName, action } = body;

    if (action === 'create') {
      const { name, mobile, playingRole, playingAs, playerPhoto } = body;
      if (!name || !mobile) {
        return NextResponse.json({ success: false, error: 'Player Name and Mobile are required' }, { status: 400 });
      }
      
      const allPlayers = await getDbPlayers();
      if (allPlayers.some(p => p.mobile === mobile.trim())) {
        return NextResponse.json({ success: false, error: 'A player with this mobile number already exists' }, { status: 400 });
      }

      const newPlayer = {
        name: name.trim(),
        mobile: mobile.trim(),
        playingRole: playingRole || '',
        playingAs: playingAs || '',
        playerPhoto: playerPhoto || ''
      };

      await addDbPlayer(newPlayer);
      return NextResponse.json({ success: true, message: 'Player profile created successfully!', data: newPlayer });
    }
    
    if (action === 'add') {
      if (!auctionName) {
        return NextResponse.json({ success: false, error: 'Auction Name is required to add player' }, { status: 400 });
      }
      const mobiles: string[] = Array.isArray(playerMobile)
        ? playerMobile
        : Array.isArray(playerMobiles)
          ? playerMobiles
          : playerMobile
            ? [playerMobile]
            : [];

      if (mobiles.length === 0) {
        return NextResponse.json({ success: false, error: 'Player Mobile number(s) required' }, { status: 400 });
      }

      const results = [];
      const errors = [];

      for (const mob of mobiles) {
        const normalized = String(mob).trim();
        try {
          const player = await getDbPlayerByMobile(normalized);
          if (!player) {
            errors.push(`Player ${normalized} not found`);
            continue;
          }
          await updatePlayerAuction(normalized, auctionName);
          results.push(player);
        } catch (err: any) {
          errors.push(err.message || `Failed to add ${normalized}`);
        }
      }

      if (errors.length > 0 && results.length === 0) {
        return NextResponse.json({ success: false, error: errors.join(', ') }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: `Assigned ${results.length} player(s) to auction pool.` + (errors.length > 0 ? ` Errors: ${errors.join(', ')}` : ''),
        data: results
      });
    }

    if (!playerMobile) {
      return NextResponse.json({ success: false, error: 'Player Mobile number is required' }, { status: 400 });
    }

    const normalizedMobile = String(playerMobile).trim();

    if (action === 'remove') {
      if (!auctionName) {
        return NextResponse.json({ success: false, error: 'Auction Name is required to remove player' }, { status: 400 });
      }
      const players = await getDbPlayers(auctionName);
      const player = players.find(p => p.mobile === normalizedMobile);
      if (!player) {
        return NextResponse.json({ success: false, error: 'Player not found in this auction' }, { status: 404 });
      }
      await removePlayerFromAuction(normalizedMobile, auctionName);
      return NextResponse.json({ success: true, message: 'Player removed from auction.' });
    }
    
    const players = await getDbPlayers(auctionName || undefined);
    const player = players.find(p => p.mobile === normalizedMobile);
    
    if (!player) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }
    
    const finalStatus = status !== undefined ? status : player.status;
    const finalTeam = team !== undefined ? team : player.team;
    const finalSoldPrice = soldPrice !== undefined && soldPrice !== null && soldPrice !== '' ? Number(soldPrice) : (soldPrice === '' ? '' : player.soldPrice);
    
    // Save to DB status & team inside the specified auction
    await updateDbPlayer(normalizedMobile, finalStatus, finalTeam, finalSoldPrice, auctionName);
    
    const updatedPlayer = {
      ...player,
      status: finalStatus,
      team: finalTeam,
      soldPrice: finalSoldPrice,
      auctionName: auctionName || player.auctionName
    };
    
    return NextResponse.json({ success: true, data: updatedPlayer });
  } catch (error: any) {
    console.error('Error updating player:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { originalMobile, player } = body;
    
    if (!originalMobile) {
      return NextResponse.json({ success: false, error: 'Original Mobile number is required' }, { status: 400 });
    }
    if (!player || !player.mobile || !player.name) {
      return NextResponse.json({ success: false, error: 'Player name and mobile are required' }, { status: 400 });
    }

    // Update in database
    await updateFullDbPlayer(originalMobile, player);
    
    return NextResponse.json({ success: true, data: player });
  } catch (error: any) {
    console.error('Error in PUT /api/players:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
