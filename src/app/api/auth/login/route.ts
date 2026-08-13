import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDbTeams, verifyDbAdmin } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { role, password, teamName, passcode } = body;

    const cookieStore = await cookies();
    
    // Determine if connection is secure (HTTPS) to set cookie attributes accordingly.
    // In production build runs accessed over HTTP (like localhost or local IP),
    // setting secure: true prevents the browser from storing/sending the cookie.
    const isSecure = request.url.startsWith('https://') || request.headers.get('x-forwarded-proto') === 'https';

    if (role === 'admin') {
      const isValidAdmin = await verifyDbAdmin('admin', password || '');
      if (isValidAdmin) {
        cookieStore.set('session', JSON.stringify({ role: 'admin', name: 'Administrator' }), {
          httpOnly: true,
          secure: isSecure,
          maxAge: 60 * 60 * 24, // 1 day
          path: '/'
        });
        return NextResponse.json({ success: true, role: 'admin', name: 'Administrator' });
      } else {
        return NextResponse.json({ success: false, error: 'Incorrect Admin password' }, { status: 401 });
      }
    } else if (role === 'team') {
      if (!teamName) {
        return NextResponse.json({ success: false, error: 'Team name is required' }, { status: 400 });
      }

      // Read teams from DB to check passcode
      const teams = await getDbTeams();
      const matchedTeam = teams.find(t => t.name.toLowerCase() === teamName.toLowerCase());

      if (!matchedTeam) {
        return NextResponse.json({ success: false, error: 'Team not registered in database' }, { status: 404 });
      }

      if (!passcode) {
        return NextResponse.json({ success: false, error: 'Passcode is required for team login' }, { status: 400 });
      }

      const storedPasscode = matchedTeam.passcode || '';
      if (storedPasscode !== passcode) {
        return NextResponse.json({ success: false, error: 'Incorrect team passcode' }, { status: 401 });
      }

      cookieStore.set('session', JSON.stringify({ role: 'team', name: matchedTeam.name }), {
        httpOnly: true,
        secure: isSecure,
        maxAge: 60 * 60 * 24, // 1 day
        path: '/'
      });

      return NextResponse.json({ success: true, role: 'team', name: matchedTeam.name });
    }

    return NextResponse.json({ success: false, error: 'Invalid login role' }, { status: 400 });
  } catch (error: any) {
    console.error('Login API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
