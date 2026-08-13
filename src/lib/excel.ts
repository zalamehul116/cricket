import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = '/var/www/html/oction/data/config.json';
const UPLOAD_DIR = '/var/www/html/oction/data';
const DEFAULT_FILE_PATH = '/home/mehul.zala/Downloads/Deshottar Gramin Cricket tournament  (Responses).xlsx';

export function getExcelFilePath(): string {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      if (config.activeFile) {
        const fullPath = path.join(UPLOAD_DIR, config.activeFile);
        if (fs.existsSync(fullPath)) {
          return fullPath;
        }
      }
    }
  } catch (err) {
    console.error('Error reading excel config:', err);
  }
  return DEFAULT_FILE_PATH;
}

export function getActiveExcelFileName(): string {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      if (config.activeFile) {
        const fullPath = path.join(UPLOAD_DIR, config.activeFile);
        if (fs.existsSync(fullPath)) {
          return config.activeFile;
        }
      }
    }
  } catch (err) {
    console.error('Error reading excel config name:', err);
  }
  return 'Default Spreadsheet';
}

export interface Player {
  id?: any; // string or number DB ID
  uuid?: string;
  timestamp: string;
  name: string;
  mobile: string;
  playingAs: string;
  playerPhoto: string;
  playingRole: string;
  status: string; // 'Sold' | 'Unsold' | 'Captain' | ''
  team: string;
  soldPrice: number | '';
  auctionName?: string;
}

export interface Team {
  id?: number;
  uuid?: string;
  name: string;
  owner: string;
  budget: number;
  logo: string;
  captain: string;
  captainMobile: string;
  passcode: string;
}

// Convert Excel Serial Date to JS Date string
function formatExcelDate(serial: any): string {
  if (!serial) return '';
  if (serial instanceof Date) {
    return serial.toLocaleString();
  }
  if (typeof serial === 'number') {
    const utcd = Date.UTC(1899, 11, 30);
    const msPerDay = 24 * 60 * 60 * 1000;
    const date = new Date(utcd + serial * msPerDay);
    return date.toLocaleString();
  }
  return String(serial);
}

// Read all players from 'Form Responses 1'
export function readPlayers(): Player[] {
  const activePath = getExcelFilePath();
  if (!fs.existsSync(activePath)) {
    throw new Error(`Excel file not found at: ${activePath}`);
  }
  
  const fileBuffer = fs.readFileSync(activePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets['Form Responses 1'];
  if (!sheet) {
    throw new Error("Sheet 'Form Responses 1' not found in Excel workbook.");
  }
  
  const rawData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  
  return rawData.map((row: any) => {
    // Normalise mobile number to string
    const mobile = row['Mobile no.'] ? String(row['Mobile no.']).trim() : '';
    return {
      id: mobile, // use mobile as unique key
      timestamp: formatExcelDate(row['Timestamp']),
      name: row['Name'] ? String(row['Name']).trim() : '',
      mobile: mobile,
      playingAs: row['Playing As'] ? String(row['Playing As']).trim() : '',
      playerPhoto: row['Player Photo'] ? String(row['Player Photo']).trim() : '',
      playingRole: row['Playing Role'] ? String(row['Playing Role']).trim() : '',
      status: row['Status'] ? String(row['Status']).trim() : '',
      team: row['Team'] ? String(row['Team']).trim() : '',
      soldPrice: row['Sold Price'] !== '' ? Number(row['Sold Price']) : ''
    };
  });
}

// Read all teams from 'Teams' sheet
export function readTeams(): Team[] {
  const activePath = getExcelFilePath();
  if (!fs.existsSync(activePath)) {
    throw new Error(`Excel file not found at: ${activePath}`);
  }
  
  const fileBuffer = fs.readFileSync(activePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  let sheet = workbook.Sheets['Teams'];
  
  if (!sheet) {
    // If teams sheet doesn't exist, create it with default teams or empty
    return [];
  }
  
  const rawData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return rawData.map((row: any) => ({
    name: row['Team Name'] ? String(row['Team Name']).trim() : '',
    owner: row['Owner Name'] ? String(row['Owner Name']).trim() : '',
    budget: row['Budget'] !== '' ? Number(row['Budget']) : 10000000,
    logo: row['Logo'] ? String(row['Logo']).trim() : '',
    captain: row['Captain'] ? String(row['Captain']).trim() : '',
    captainMobile: row['Captain Mobile'] ? String(row['Captain Mobile']).trim() : '',
    passcode: row['Passcode'] ? String(row['Passcode']).trim() : ''
  }));
}

// Save teams list and players back to Excel
export function updatePlayerAndTeams(
  updatedPlayers: Player[],
  updatedTeams?: Team[]
): void {
  const activePath = getExcelFilePath();
  if (!fs.existsSync(activePath)) {
    throw new Error(`Excel file not found at: ${activePath}`);
  }
  
  const fileBuffer = fs.readFileSync(activePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true, cellStyles: true });
  
  // 1. Update 'Form Responses 1' sheet
  const playerSheet = workbook.Sheets['Form Responses 1'];
  if (!playerSheet) {
    throw new Error("Sheet 'Form Responses 1' not found in Excel workbook.");
  }
  
  // Get all rows in 'Form Responses 1'
  const playerRows: any[] = XLSX.utils.sheet_to_json(playerSheet, { header: 1 });
  const headers = playerRows[0] as string[];
  
  // Indices of columns
  const statusIdx = headers.indexOf('Status');
  const teamIdx = headers.indexOf('Team');
  const soldPriceIdx = headers.indexOf('Sold Price');
  const mobileIdx = headers.indexOf('Mobile no.');
  
  if (statusIdx === -1 || teamIdx === -1 || soldPriceIdx === -1 || mobileIdx === -1) {
    throw new Error("Invalid column structure in sheet 'Form Responses 1'. Missing Status, Team, Sold Price, or Mobile no.");
  }
  
  // Go through player rows (row index 1 to length-1)
  for (let r = 1; r < playerRows.length; r++) {
    const rowVal = playerRows[r];
    if (!rowVal || rowVal.length === 0) continue;
    
    const rowMobile = rowVal[mobileIdx] ? String(rowVal[mobileIdx]).trim() : '';
    const matchedPlayer = updatedPlayers.find(p => p.mobile === rowMobile);
    
    if (matchedPlayer) {
      // Update cell values in SheetJS sheet object
      // Status
      const statusCellRef = XLSX.utils.encode_cell({ r: r, c: statusIdx });
      playerSheet[statusCellRef] = { t: 's', v: matchedPlayer.status };
      
      // Team
      const teamCellRef = XLSX.utils.encode_cell({ r: r, c: teamIdx });
      playerSheet[teamCellRef] = { t: 's', v: matchedPlayer.team };
      
      // Sold Price
      const soldPriceCellRef = XLSX.utils.encode_cell({ r: r, c: soldPriceIdx });
      if (matchedPlayer.soldPrice !== '') {
        playerSheet[soldPriceCellRef] = { t: 'n', v: matchedPlayer.soldPrice };
      } else {
        // delete cell value
        delete playerSheet[soldPriceCellRef];
      }
    }
  }
  
  // 2. Update or create 'Teams' sheet if updatedTeams is provided
  if (updatedTeams) {
    // Format teams data for SheetJS
    const teamsData = updatedTeams.map(t => ({
      'Team Name': t.name,
      'Owner Name': t.owner,
      'Budget': t.budget,
      'Logo': t.logo,
      'Captain': t.captain,
      'Captain Mobile': t.captainMobile,
      'Passcode': t.passcode || ''
    }));
    
    const teamSheet = XLSX.utils.json_to_sheet(teamsData);
    
    // Add sheet to workbook (replace if exists)
    if (workbook.Sheets['Teams']) {
      workbook.Sheets['Teams'] = teamSheet;
    } else {
      XLSX.utils.book_append_sheet(workbook, teamSheet, 'Teams');
    }
  }
  
  // Write workbook back to disk
  const outputBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  fs.writeFileSync(activePath, outputBuffer);
}

export interface Auction {
  id?: number;
  uuid?: string;
  name: string;
  status: 'Active' | 'Draft' | 'Completed';
  teams: string[]; // array of team names
  activePlayerMobile: string;
  currentBidPrice: number;
  currentBidderTeam: string;
  timerEndsAt?: string | null;
  playersLimit?: number;
  timerDuration?: number;
  isPaused?: boolean;
  pausedTimeRemaining?: number | null;
}

// Read all auctions from 'Auctions' sheet
export function readAuctions(): Auction[] {
  const activePath = getExcelFilePath();
  if (!fs.existsSync(activePath)) {
    throw new Error(`Excel file not found at: ${activePath}`);
  }
  
  const fileBuffer = fs.readFileSync(activePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  let sheet = workbook.Sheets['Auctions'];
  
  if (!sheet) {
    return [];
  }
  
  const rawData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return rawData.map((row: any) => ({
    name: row['Auction Name'] ? String(row['Auction Name']).trim() : '',
    status: (row['Status'] ? String(row['Status']).trim() : 'Draft') as 'Active' | 'Draft' | 'Completed',
    teams: row['Participating Teams'] ? String(row['Participating Teams']).split(',').map((t: any) => t.trim()).filter(Boolean) : [],
    activePlayerMobile: row['Active Player Mobile'] ? String(row['Active Player Mobile']).trim() : '',
    currentBidPrice: row['Current Bid Price'] !== '' ? Number(row['Current Bid Price']) : 0,
    currentBidderTeam: row['Current Bidder Team'] ? String(row['Current Bidder Team']).trim() : ''
  }));
}

// Write/update all auctions in the Excel file
export function updateAuctions(auctions: Auction[]): void {
  const activePath = getExcelFilePath();
  if (!fs.existsSync(activePath)) {
    throw new Error(`Excel file not found at: ${activePath}`);
  }
  
  const fileBuffer = fs.readFileSync(activePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true, cellStyles: true });
  
  const auctionsData = auctions.map(a => ({
    'Auction Name': a.name,
    'Status': a.status,
    'Participating Teams': a.teams.join(', '),
    'Active Player Mobile': a.activePlayerMobile,
    'Current Bid Price': a.currentBidPrice,
    'Current Bidder Team': a.currentBidderTeam
  }));
  
  const auctionSheet = XLSX.utils.json_to_sheet(auctionsData);
  
  if (workbook.Sheets['Auctions']) {
    workbook.Sheets['Auctions'] = auctionSheet;
  } else {
    XLSX.utils.book_append_sheet(workbook, auctionSheet, 'Auctions');
  }
  
  const outputBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  fs.writeFileSync(activePath, outputBuffer);
}
