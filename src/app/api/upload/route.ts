import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { resetAndSeedDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const UPLOAD_DIR = '/var/www/html/oction/data';
const CONFIG_PATH = path.join(UPLOAD_DIR, 'config.json');

// Ensure UPLOAD_DIR exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Helper to get configuration
function getConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    } catch (e) {
      console.error('Error parsing config', e);
    }
  }
  return { activeFile: null };
}

// Helper to save configuration
function saveConfig(activeFile: string | null) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ activeFile }, null, 2));
}

export async function GET() {
  try {
    const config = getConfig();
    
    // Read all excel files in the folder
    let files: string[] = [];
    if (fs.existsSync(UPLOAD_DIR)) {
      files = fs.readdirSync(UPLOAD_DIR).filter(file => {
        const ext = path.extname(file).toLowerCase();
        return (ext === '.xlsx' || ext === '.xls') && file !== 'config.json';
      });
    }

    const isUploaded = !!config.activeFile && fs.existsSync(path.join(UPLOAD_DIR, config.activeFile));
    const activeFileName = isUploaded ? config.activeFile : null;
    const sourceName = isUploaded ? `${config.activeFile} (Uploaded)` : 'Deshottar Gramin Cricket tournament (Responses).xlsx (Default)';

    return NextResponse.json({
      success: true,
      activeFile: activeFileName,
      isUploaded,
      source: sourceName,
      files
    });
  } catch (error: any) {
    console.error('Error fetching source details:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      // Action: Select existing file from list
      const body = await request.json();
      const filename = body.filename;
      
      if (!filename) {
        // If filename is null or empty, reset to default
        saveConfig(null);
        await resetAndSeedDb();
        return NextResponse.json({
          success: true,
          message: 'Reset to default spreadsheet successfully!'
        });
      }

      const fullPath = path.join(UPLOAD_DIR, filename);
      if (!fs.existsSync(fullPath)) {
        return NextResponse.json({ success: false, error: `File ${filename} not found in folder.` }, { status: 404 });
      }

      saveConfig(filename);
      await resetAndSeedDb();
      return NextResponse.json({
        success: true,
        message: `Activated spreadsheet: ${filename}`
      });
    } else {
      // Action: Upload a new file
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      
      if (!file) {
        return NextResponse.json({ success: false, error: 'No file provided in request' }, { status: 400 });
      }
      
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      // Use the original file name, sanitize it slightly (remove path traversals)
      const fileName = path.basename(file.name);
      
      // Save uploaded file into data folder
      const targetPath = path.join(UPLOAD_DIR, fileName);
      fs.writeFileSync(targetPath, buffer);
      
      // Auto-select the newly uploaded file as active
      saveConfig(fileName);
      await resetAndSeedDb();
      
      return NextResponse.json({ 
        success: true, 
        message: `Sheet "${fileName}" uploaded and configured successfully!` 
      });
    }
  } catch (error: any) {
    console.error('Upload/Selection error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');
    
    if (filename) {
      // Delete a specific file from directory
      const fullPath = path.join(UPLOAD_DIR, filename);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      
      // If we deleted the active file, reset configuration to default
      const config = getConfig();
      if (config.activeFile === filename) {
        saveConfig(null);
        await resetAndSeedDb();
      }
      
      return NextResponse.json({
        success: true,
        message: `Deleted file "${filename}" from server folder.`
      });
    } else {
      // Reset config active file to default
      saveConfig(null);
      await resetAndSeedDb();
      return NextResponse.json({ 
        success: true, 
        message: 'Reset configuration. Now using default spreadsheet!' 
      });
    }
  } catch (error: any) {
    console.error('Reset/Delete error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
