import { NextResponse } from 'next/server';
import ImageKit from 'imagekit';

export const dynamic = 'force-dynamic';

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || '',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || ''
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }
    
    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ success: false, error: 'Only image files are allowed' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Upload to ImageKit
    const uploadResponse = await imagekit.upload({
      file: buffer,
      fileName: file.name,
      folder: '/oction-uploads'
    });
    
    const endpoint = (process.env.IMAGEKIT_URL_ENDPOINT || '').replace(/\/$/, '');
    const imageUrl = uploadResponse.url?.startsWith('http')
      ? uploadResponse.url
      : `${endpoint}${uploadResponse.filePath.startsWith('/') ? '' : '/'}${uploadResponse.filePath}`;

    return NextResponse.json({ success: true, url: imageUrl });
  } catch (error: any) {
    console.error('Error uploading image to ImageKit:', error);
    let errorMsg = error.message || 'Unknown upload error';
    if (
      errorMsg.includes('resolution') || 
      errorMsg.includes('ELIMIT') || 
      errorMsg.includes('25.0 MP') || 
      errorMsg.includes('limit')
    ) {
      errorMsg = 'Image resolution exceeds the 25.0 Megapixel limit of the ImageKit free tier. Please upload a smaller image.';
    }
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
