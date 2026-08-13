import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      return NextResponse.json({ success: true, loggedIn: false });
    }

    const session = JSON.parse(sessionCookie.value);
    return NextResponse.json({
      success: true,
      loggedIn: true,
      role: session.role,
      name: session.name
    });
  } catch (error: any) {
    console.error('Session API error:', error);
    // If JSON parsing fails or other issues, clear session
    return NextResponse.json({ success: true, loggedIn: false });
  }
}
