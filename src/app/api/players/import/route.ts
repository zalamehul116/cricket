import { NextResponse } from 'next/server';
import { importPlayersFromBuffer } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await importPlayersFromBuffer(buffer);

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${result.count} players from the Excel sheet!`
    });
  } catch (error: any) {
    console.error('Import players error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
