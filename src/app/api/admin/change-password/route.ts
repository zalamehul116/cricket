import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyDbAdmin, updateDbAdminPassword } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please login first.' }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);
    if (session.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Access denied. Administrator privileges required.' }, { status: 403 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ success: false, error: 'Current password and new password are required.' }, { status: 400 });
    }

    if (newPassword.trim().length < 4) {
      return NextResponse.json({ success: false, error: 'New password must be at least 4 characters long.' }, { status: 400 });
    }

    // Verify current password
    const isCurrentValid = await verifyDbAdmin('admin', currentPassword);
    if (!isCurrentValid) {
      return NextResponse.json({ success: false, error: 'Incorrect current password.' }, { status: 401 });
    }

    // Update password
    await updateDbAdminPassword('admin', newPassword);

    return NextResponse.json({ success: true, message: 'Password changed successfully.' });
  } catch (error: any) {
    console.error('Change password API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
