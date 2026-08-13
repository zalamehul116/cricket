import { NextResponse } from 'next/server';
import { getDbTeams, addDbTeam, updateFullDbTeam } from '@/lib/db';
import { Team } from '@/lib/excel';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const auctionName = searchParams.get('auctionName') || undefined;
    const teams = await getDbTeams(auctionName);
    return NextResponse.json({ success: true, data: teams });
  } catch (error: any) {
    console.error('Error fetching teams:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, owner, budget, logo, passcode } = body;
    
    if (!name) {
      return NextResponse.json({ success: false, error: 'Team name is required' }, { status: 400 });
    }
    
    const teams = await getDbTeams();
    
    // Check if team already exists
    if (teams.some(t => t.name.toLowerCase() === name.trim().toLowerCase())) {
      return NextResponse.json({ success: false, error: 'Team name already exists' }, { status: 400 });
    }
    
    const newTeam: Team = {
      name: name.trim(),
      owner: owner ? owner.trim() : '',
      budget: budget ? Number(budget) : 10000000,
      logo: logo ? logo.trim() : '',
      captain: '',
      captainMobile: '',
      passcode: passcode ? passcode.trim() : ''
    };
    
    // Save to DB
    await addDbTeam(newTeam);
    
    return NextResponse.json({ success: true, data: newTeam });
  } catch (error: any) {
    console.error('Error registering team:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { originalName, team } = body;
    
    if (!originalName) {
      return NextResponse.json({ success: false, error: 'Original Team name is required' }, { status: 400 });
    }
    if (!team || !team.name) {
      return NextResponse.json({ success: false, error: 'Team name is required' }, { status: 400 });
    }

    const teams = await getDbTeams();
    if (
      originalName.toLowerCase() !== team.name.trim().toLowerCase() &&
      teams.some(t => t.name.toLowerCase() === team.name.trim().toLowerCase())
    ) {
      return NextResponse.json({ success: false, error: 'Team name already exists' }, { status: 400 });
    }

    await updateFullDbTeam(originalName, team);
    
    return NextResponse.json({ success: true, data: team });
  } catch (error: any) {
    console.error('Error in PUT /api/teams:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
