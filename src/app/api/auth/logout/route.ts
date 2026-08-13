import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('session');
    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (error: any) {
    console.error('Logout API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
