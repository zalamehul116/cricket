import { NextResponse } from 'next/server';
import { getDbAuctions, addDbAuction, updateDbAuction, deleteDbAuction, updateDbAuctionName } from '@/lib/db';
import { Auction } from '@/lib/excel';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auctions = await getDbAuctions();
    return NextResponse.json({ success: true, auctions });
  } catch (error: any) {
    console.error('Fetch auctions error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, action, teams, mobile, basePrice, bidderTeam, playersLimit } = body;
    
    const auctions = await getDbAuctions();

    if (!action) {
      // Create new auction
      if (!name) {
        return NextResponse.json({ success: false, error: 'Auction name is required' }, { status: 400 });
      }

      const exists = auctions.some(a => a.name.toLowerCase() === name.toLowerCase());
      if (exists) {
        return NextResponse.json({ success: false, error: 'An auction with this name already exists' }, { status: 400 });
      }

      const newAuction: Auction = {
        name: name.trim(),
        status: 'Draft',
        teams: Array.isArray(teams) ? teams : [],
        activePlayerMobile: '',
        currentBidPrice: 0,
        currentBidderTeam: '',
        playersLimit: playersLimit !== undefined ? Number(playersLimit) : 20
      };

      await addDbAuction(newAuction);

      return NextResponse.json({ success: true, message: 'Auction created successfully!', auction: newAuction });
    }

    // Perform specific action on an auction
    const matchedAuctionIdx = auctions.findIndex(a => a.name.toLowerCase() === name.toLowerCase());
    if (matchedAuctionIdx === -1) {
      return NextResponse.json({ success: false, error: 'Auction not found' }, { status: 404 });
    }

    const matchedAuction = auctions[matchedAuctionIdx];

    if (action === 'activate') {
      matchedAuction.status = 'Active';
      await updateDbAuction(matchedAuction);
      return NextResponse.json({ success: true, message: `Auction "${matchedAuction.name}" is now Active!` });
    }

    if (action === 'deactivate') {
      matchedAuction.status = 'Draft';
      matchedAuction.activePlayerMobile = '';
      matchedAuction.currentBidderTeam = '';
      matchedAuction.timerEndsAt = null;
      matchedAuction.isPaused = false;
      matchedAuction.pausedTimeRemaining = null;
      await updateDbAuction(matchedAuction);
      return NextResponse.json({ success: true, message: `Auction "${matchedAuction.name}" is no longer active.` });
    }

    if (action === 'complete') {
      matchedAuction.status = 'Completed';
      matchedAuction.activePlayerMobile = ''; // clear active player
      await updateDbAuction(matchedAuction);
      return NextResponse.json({ success: true, message: `Auction "${matchedAuction.name}" is now Completed!` });
    }

    if (action === 'updateTeams') {
      matchedAuction.teams = Array.isArray(teams) ? teams : [];
      await updateDbAuction(matchedAuction);
      return NextResponse.json({ success: true, message: 'Participating teams updated successfully!' });
    }

    if (action === 'edit') {
      const { newName } = body;
      let nameToUse = matchedAuction.name;
      
      if (newName && newName.trim() && newName.trim().toLowerCase() !== name.toLowerCase()) {
        const exists = auctions.some(a => a.name.toLowerCase() === newName.trim().toLowerCase());
        if (exists) {
          return NextResponse.json({ success: false, error: 'An auction with the new name already exists' }, { status: 400 });
        }
        await updateDbAuctionName(name, newName.trim());
        nameToUse = newName.trim();
        matchedAuction.name = nameToUse;
      }
      
      if (teams !== undefined) {
        matchedAuction.teams = Array.isArray(teams) ? teams : [];
      }

      if (body.playersLimit !== undefined) {
        matchedAuction.playersLimit = Number(body.playersLimit);
      }
      
      await updateDbAuction(matchedAuction);
      
      return NextResponse.json({ success: true, message: 'Auction updated successfully!', name: nameToUse });
    }

    if (action === 'delete') {
      await deleteDbAuction(name);
      return NextResponse.json({ success: true, message: 'Auction deleted successfully!' });
    }

    if (action === 'setPlayer') {
      // Set active player on block
      if (matchedAuction.status !== 'Active') {
        return NextResponse.json({ success: false, error: 'Cannot set player on a non-active auction' }, { status: 400 });
      }

      matchedAuction.activePlayerMobile = mobile || '';
      matchedAuction.currentBidPrice = basePrice ? Number(basePrice) : 50000;
      
      // Update bidder team if provided; clear if mobile is empty (clearing block)
      if (!matchedAuction.activePlayerMobile) {
        matchedAuction.currentBidderTeam = '';
        matchedAuction.timerEndsAt = null;
        matchedAuction.isPaused = false;
        matchedAuction.pausedTimeRemaining = null;
      } else {
        // Set new timer end time (using configured timerDuration, default to 120s)
        matchedAuction.timerEndsAt = new Date(Date.now() + (matchedAuction.timerDuration || 120) * 1000).toISOString();
        matchedAuction.isPaused = false;
        matchedAuction.pausedTimeRemaining = null;
        if (bidderTeam !== undefined) {
          matchedAuction.currentBidderTeam = bidderTeam;
        }
      }
      
      await updateDbAuction(matchedAuction);
      
      return NextResponse.json({ success: true, message: 'Player is now on the bidding block!' });
    }

    if (action === 'resetBid') {
      matchedAuction.currentBidPrice = basePrice ? Number(basePrice) : 50000;
      matchedAuction.currentBidderTeam = '';
      matchedAuction.isPaused = false;
      matchedAuction.pausedTimeRemaining = null;
      // Reset timer to configured timerDuration
      matchedAuction.timerEndsAt = new Date(Date.now() + (matchedAuction.timerDuration || 120) * 1000).toISOString();
      await updateDbAuction(matchedAuction);
      return NextResponse.json({ success: true, message: 'Bidding reset for current player.' });
    }

    if (action === 'pause') {
      if (matchedAuction.status !== 'Active') {
        return NextResponse.json({ success: false, error: 'Cannot pause a non-active auction' }, { status: 400 });
      }
      if (matchedAuction.isPaused) {
        return NextResponse.json({ success: false, error: 'Auction is already paused' }, { status: 400 });
      }

      // Calculate time remaining
      let remaining = 0;
      if (matchedAuction.timerEndsAt) {
        remaining = Math.max(0, Math.ceil((new Date(matchedAuction.timerEndsAt).getTime() - Date.now()) / 1000));
      } else {
        remaining = matchedAuction.timerDuration || 120;
      }

      matchedAuction.isPaused = true;
      matchedAuction.pausedTimeRemaining = remaining;
      await updateDbAuction(matchedAuction);

      return NextResponse.json({ success: true, message: 'Auction paused successfully!' });
    }

    if (action === 'resume') {
      if (matchedAuction.status !== 'Active') {
        return NextResponse.json({ success: false, error: 'Cannot resume a non-active auction' }, { status: 400 });
      }
      if (!matchedAuction.isPaused) {
        return NextResponse.json({ success: false, error: 'Auction is not paused' }, { status: 400 });
      }

      const remaining = matchedAuction.pausedTimeRemaining !== null && matchedAuction.pausedTimeRemaining !== undefined 
        ? matchedAuction.pausedTimeRemaining 
        : (matchedAuction.timerDuration || 120);

      matchedAuction.isPaused = false;
      matchedAuction.pausedTimeRemaining = null;
      // Recalculate timerEndsAt from now
      matchedAuction.timerEndsAt = new Date(Date.now() + remaining * 1000).toISOString();

      await updateDbAuction(matchedAuction);

      return NextResponse.json({ success: true, message: 'Auction resumed successfully!' });
    }

    return NextResponse.json({ success: false, error: 'Invalid auction action' }, { status: 400 });
  } catch (error: any) {
    console.error('Update auction error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
