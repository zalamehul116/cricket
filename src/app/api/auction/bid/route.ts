import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDbAuctions, updateDbAuction, getDbTeams, getDbPlayers } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please login first.' }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);
    if (session.role !== 'team') {
      return NextResponse.json({ success: false, error: 'Only logged-in teams can place bids' }, { status: 403 });
    }

    const teamName = session.name;
    const body = await request.json();
    const { bidPrice, auctionName } = body;

    if (bidPrice === undefined || bidPrice === null || typeof bidPrice !== 'number' || bidPrice < 0) {
      return NextResponse.json({ success: false, error: 'Invalid bid price' }, { status: 400 });
    }

    // Find the auction
    const auctions = await getDbAuctions();
    const activeAuction = auctionName
      ? auctions.find(a => a.name.toLowerCase() === auctionName.toLowerCase())
      : auctions.find(a => a.status === 'Active');

    if (!activeAuction) {
      return NextResponse.json({ success: false, error: auctionName ? `Auction "${auctionName}" not found` : 'No active auction currently running' }, { status: 400 });
    }

    if (!activeAuction.activePlayerMobile) {
      return NextResponse.json({ success: false, error: 'No player is currently on the bidding block' }, { status: 400 });
    }

    // Verify team is participating in this auction
    const isParticipating = activeAuction.teams.some(t => t.toLowerCase() === teamName.toLowerCase());
    if (!isParticipating) {
      return NextResponse.json({ success: false, error: `Team "${teamName}" is not registered to participate in this auction.` }, { status: 403 });
    }

    // Validate that the bid is higher than the current bid price (or equal to it if it's the first bid)
    const isFirstBid = !activeAuction.currentBidderTeam;
    if (isFirstBid ? (bidPrice < activeAuction.currentBidPrice) : (bidPrice <= activeAuction.currentBidPrice)) {
      return NextResponse.json({
        success: false,
        error: isFirstBid
          ? `Bid must be at least the starting price of ${activeAuction.currentBidPrice.toLocaleString()} INR`
          : `Bid must be higher than current bid price of ${activeAuction.currentBidPrice.toLocaleString()} INR`
      }, { status: 400 });
    }

    // Check team budget
    const teams = await getDbTeams();
    const matchedTeam = teams.find(t => t.name.toLowerCase() === teamName.toLowerCase());
    if (!matchedTeam) {
      return NextResponse.json({ success: false, error: 'Team details not found' }, { status: 404 });
    }

    const players = await getDbPlayers();
    
    // Calculate total money spent by this team
    const spentMoney = players
      .filter(p => p.team.toLowerCase() === teamName.toLowerCase() && p.status !== 'Unsold')
      .reduce((sum, p) => sum + (typeof p.soldPrice === 'number' ? p.soldPrice : 0), 0);

    const remainingBudget = matchedTeam.budget - spentMoney;

    if (bidPrice > remainingBudget) {
      return NextResponse.json({
        success: false,
        error: `Insufficient budget! Your remaining budget is ${remainingBudget.toLocaleString()} INR, but you bidded ${bidPrice.toLocaleString()} INR.`
      }, { status: 400 });
    }

    // All validation passed, update current bid
    activeAuction.currentBidPrice = bidPrice;
    activeAuction.currentBidderTeam = teamName;
    activeAuction.timerEndsAt = new Date(Date.now() + (activeAuction.timerDuration || 120) * 1000).toISOString();
    
    await updateDbAuction(activeAuction);

    return NextResponse.json({
      success: true,
      message: 'Bid placed successfully!',
      currentBidPrice: bidPrice,
      currentBidderTeam: teamName
    });
  } catch (error: any) {
    console.error('Bid API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
