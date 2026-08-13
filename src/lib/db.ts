import pg from 'pg';
import * as XLSX from 'xlsx';
import { readPlayers, readTeams, readAuctions } from './excel';
import { Player, Team, Auction } from './excel';

const { Pool } = pg;

function getPoolConfig(): pg.PoolConfig {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required. Set your PostgreSQL connection string in .env.local');
  }

  const needsSsl =
    connectionString.includes('sslmode=require') ||
    connectionString.includes('sslmode=verify-full') ||
    /neon\.tech|supabase\.co/.test(connectionString);

  return {
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 10,
  };
}

// PostgreSQL connection
const pool = new Pool(getPoolConfig());

function toPgSql(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

/** Query wrapper: converts ? placeholders to PostgreSQL $1, $2, ... and returns [rows] */
async function query(sql: string, params: any[] = []): Promise<[any[]]> {
  const result = await pool.query(toPgSql(sql), params);
  return [result.rows];
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const [rows] = await query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ? AND LOWER(column_name) = ?`,
    [table, column.toLowerCase()]
  );
  return rows.length > 0;
}

let isDbInitialized = false;
let initPromise: Promise<void> | null = null;

async function initDb() {
  try {
    console.log('Initializing PostgreSQL database tables...');

    // Run self-healing migration to add UUID columns if tables already exist
    try {
      await query('ALTER TABLE teams ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT gen_random_uuid() UNIQUE');
      await query('ALTER TABLE players ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT gen_random_uuid() UNIQUE');
      await query('ALTER TABLE auctions ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT gen_random_uuid() UNIQUE');
    } catch (e) {
      // Ignored: tables may not exist yet, they will be created below
    }

    let tableNeedsRefactor = false;
    try {
      const hasPlayerId = await columnExists('players', 'id');
      const hasPlayersLimit = await columnExists('auctions', 'playerslimit');
      const hasTimerDuration = await columnExists('auctions', 'timerduration');
      const hasIsPaused = await columnExists('auctions', 'ispaused');
      if (!hasPlayerId || !hasPlayersLimit || !hasTimerDuration || !hasIsPaused) {
        tableNeedsRefactor = true;
      }
    } catch {
      // tables might not exist yet
    }

    if (tableNeedsRefactor) {
      console.log('Migration: Recreating tables with updated schema...');
      await query('DROP TABLE IF EXISTS auction_players CASCADE');
      await query('DROP TABLE IF EXISTS auction_teams CASCADE');
      await query('DROP TABLE IF EXISTS auctions CASCADE');
      await query('DROP TABLE IF EXISTS players CASCADE');
      await query('DROP TABLE IF EXISTS teams CASCADE');
    }

    await query(`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
        name VARCHAR(100) NOT NULL UNIQUE,
        owner VARCHAR(100) NOT NULL DEFAULT '',
        budget BIGINT NOT NULL DEFAULT 10000000,
        logo TEXT NULL,
        captain VARCHAR(100) NOT NULL DEFAULT '',
        captainmobile VARCHAR(20) NOT NULL DEFAULT '',
        passcode VARCHAR(50) NOT NULL DEFAULT ''
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
        mobile VARCHAR(20) NOT NULL UNIQUE,
        timestamp VARCHAR(50) NOT NULL DEFAULT '',
        name VARCHAR(100) NOT NULL DEFAULT '',
        playingas VARCHAR(100) NOT NULL DEFAULT '',
        playerphoto TEXT NULL,
        playingrole VARCHAR(100) NOT NULL DEFAULT ''
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS auctions (
        id SERIAL PRIMARY KEY,
        uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
        name VARCHAR(100) NOT NULL UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT 'Draft',
        teams TEXT NULL,
        activeplayerid INT NULL REFERENCES players(id) ON DELETE SET NULL,
        currentbidprice INT NOT NULL DEFAULT 0,
        currentbidderteamid INT NULL REFERENCES teams(id) ON DELETE SET NULL,
        timerendsat VARCHAR(50) NULL,
        playerslimit INT NOT NULL DEFAULT 20,
        timerduration INT NOT NULL DEFAULT 120,
        ispaused BOOLEAN NOT NULL DEFAULT FALSE,
        pausedtimeremaining INT NULL
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS auction_players (
        id SERIAL PRIMARY KEY,
        auctionid INT NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
        playerid INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT '',
        teamid INT NULL REFERENCES teams(id) ON DELETE SET NULL,
        soldprice INT NULL,
        UNIQUE (auctionid, playerid)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS auction_teams (
        id SERIAL PRIMARY KEY,
        auctionid INT NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
        teamid INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        budget BIGINT NOT NULL DEFAULT 10000000,
        UNIQUE (auctionid, teamid)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL
      )
    `);

    const [adminRows] = await query('SELECT COUNT(*)::int AS count FROM admins');
    const adminCount = adminRows[0]?.count || 0;
    if (adminCount === 0) {
      await query('INSERT INTO admins (username, password) VALUES (?, ?)', ['admin', 'admin']);
      console.log('Seeded default admin credentials into admins table.');
    }

    const [playersRows] = await query('SELECT COUNT(*)::int AS count FROM players');
    const [teamsRows] = await query('SELECT COUNT(*)::int AS count FROM teams');

    const playersCount = playersRows[0]?.count || 0;
    const teamsCount = teamsRows[0]?.count || 0;

    if (playersCount === 0 && teamsCount === 0) {
      console.log('Database tables are empty. Auto-seeding from Excel...');
      await seedFromExcel();
    } else {
      console.log(`Database tables already populated: ${playersCount} players, ${teamsCount} teams.`);
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

export async function ensureDbInitialized() {
  if (isDbInitialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      await initDb();
      isDbInitialized = true;
    })();
  }
  return initPromise;
}

export async function seedFromExcel() {
  try {
    const excelTeams = readTeams();
    console.log(`Seeding ${excelTeams.length} teams...`);
    for (const team of excelTeams) {
      await query(
        `INSERT INTO teams (name, owner, budget, logo, captain, captainMobile, passcode)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (name) DO UPDATE SET
           owner = EXCLUDED.owner,
           budget = EXCLUDED.budget,
           logo = EXCLUDED.logo,
           captain = EXCLUDED.captain,
           captainMobile = EXCLUDED.captainMobile,
           passcode = EXCLUDED.passcode`,
        [
          team.name, team.owner, team.budget, team.logo, team.captain, team.captainMobile, team.passcode || '',
        ]
      );
    }

    const excelPlayers = readPlayers();
    console.log(`Seeding ${excelPlayers.length} players...`);
    for (const player of excelPlayers) {
      await query(
        `INSERT INTO players (mobile, timestamp, name, playingAs, playerPhoto, playingRole)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (mobile) DO UPDATE SET
           timestamp = EXCLUDED.timestamp,
           name = EXCLUDED.name,
           playingAs = EXCLUDED.playingAs,
           playerPhoto = EXCLUDED.playerPhoto,
           playingRole = EXCLUDED.playingRole`,
        [player.mobile, player.timestamp, player.name, player.playingAs, player.playerPhoto, player.playingRole]
      );
    }

    const excelAuctions = readAuctions();
    console.log(`Seeding ${excelAuctions.length} auctions...`);
    for (const auction of excelAuctions) {
      const teamIds: number[] = [];
      if (auction.teams && auction.teams.length > 0) {
        for (const tName of auction.teams) {
          const [teamResult] = await query('SELECT id FROM teams WHERE name = ?', [tName]);
          if (teamResult.length > 0) teamIds.push(teamResult[0].id);
        }
      }

      let activePlayerId: number | null = null;
      if (auction.activePlayerMobile) {
        const [playerResult] = await query('SELECT id FROM players WHERE mobile = ?', [auction.activePlayerMobile]);
        if (playerResult.length > 0) activePlayerId = playerResult[0].id;
      }

      let currentBidderTeamId: number | null = null;
      if (auction.currentBidderTeam) {
        const [teamResult] = await query('SELECT id FROM teams WHERE name = ?', [auction.currentBidderTeam]);
        if (teamResult.length > 0) currentBidderTeamId = teamResult[0].id;
      }

      await query(
        `INSERT INTO auctions (name, status, teams, activePlayerId, currentBidPrice, currentBidderTeamId)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (name) DO UPDATE SET
           status = EXCLUDED.status,
           teams = EXCLUDED.teams,
           activePlayerId = EXCLUDED.activePlayerId,
           currentBidPrice = EXCLUDED.currentBidPrice,
           currentBidderTeamId = EXCLUDED.currentBidderTeamId`,
        [
          auction.name, auction.status, JSON.stringify(teamIds), activePlayerId,
          auction.currentBidPrice, currentBidderTeamId,
        ]
      );

      const [auctionResult] = await query('SELECT id FROM auctions WHERE name = ?', [auction.name]);
      const auctionId = auctionResult[0].id;

      for (const player of excelPlayers) {
        const [playerResult] = await query('SELECT id FROM players WHERE mobile = ?', [player.mobile]);
        if (playerResult.length > 0) {
          const playerId = playerResult[0].id;

          let teamId: number | null = null;
          if (player.team) {
            const [teamResult] = await query('SELECT id FROM teams WHERE name = ?', [player.team]);
            if (teamResult.length > 0) teamId = teamResult[0].id;
          }

          await query(
            `INSERT INTO auction_players (auctionId, playerId, status, teamId, soldPrice)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT (auctionId, playerId) DO UPDATE SET
               status = EXCLUDED.status,
               teamId = EXCLUDED.teamId,
               soldPrice = EXCLUDED.soldPrice`,
            [
              auctionId, playerId, player.status || '', teamId,
              player.soldPrice === '' ? null : player.soldPrice,
            ]
          );
        }
      }
    }

    console.log('Database seeding successfully finished.');
  } catch (error) {
    console.error('Error seeding database from Excel:', error);
    throw error;
  }
}

export async function resetAndSeedDb() {
  await ensureDbInitialized();
  console.log('Resetting database tables and reloading from active Excel sheet...');
  await query('DELETE FROM auction_players');
  await query('DELETE FROM auction_teams');
  await query('DELETE FROM players');
  await query('DELETE FROM teams');
  await query('DELETE FROM auctions');
  await seedFromExcel();
}

export async function getDbPlayers(auctionName?: string): Promise<Player[]> {
  await ensureDbInitialized();
  let rows: any[] = [];

  if (auctionName) {
    const [aucResult] = await query('SELECT id FROM auctions WHERE name = ? OR uuid::text = ?', [auctionName, auctionName]);
    if (aucResult.length > 0) {
      const auctionId = aucResult[0].id;
      const [qRows] = await query(
        `SELECT p.*, ap.status, ap.soldprice, t.name as team, a.name as auctionname
         FROM auction_players ap
         INNER JOIN players p ON p.id = ap.playerid
         INNER JOIN auctions a ON ap.auctionid = a.id
         LEFT JOIN teams t ON ap.teamid = t.id
         WHERE ap.auctionid = ?`,
        [auctionId]
      );
      rows = qRows;
    }
  } else {
    let targetAuctionName: string | undefined;
    let targetAuctionUuid: string | undefined;
    const [actAuc] = await query("SELECT name, uuid::text as uuid FROM auctions WHERE status = 'Active' LIMIT 1");
    if (actAuc.length > 0) {
      targetAuctionName = actAuc[0].name;
      targetAuctionUuid = actAuc[0].uuid;
    }

    if (targetAuctionName) {
      const [aucResult] = await query('SELECT id FROM auctions WHERE name = ? OR uuid::text = ?', [targetAuctionName, targetAuctionUuid]);
      if (aucResult.length > 0) {
        const auctionId = aucResult[0].id;
        const [qRows] = await query(
          `SELECT p.*, ap.status, ap.soldprice, t.name as team, a.name as auctionname
           FROM players p
           LEFT JOIN auction_players ap ON p.id = ap.playerid AND ap.auctionid = ?
           LEFT JOIN teams t ON ap.teamid = t.id
           LEFT JOIN auctions a ON ap.auctionid = a.id`,
          [auctionId]
        );
        rows = qRows;
      }
    } else {
      const [qRows] = await query(
        `SELECT p.*, NULL as status, NULL as team, NULL as soldprice, NULL as auctionname FROM players p`
      );
      rows = qRows;
    }
  }

  return rows.map((row) => ({
    id: row.id,
    uuid: row.uuid || '',
    timestamp: row.timestamp || '',
    name: row.name || '',
    mobile: row.mobile || '',
    playingAs: row.playingAs || row.playingas || '',
    playerPhoto: row.playerphoto || row.playerPhoto || '',
    playingRole: row.playingrole || row.playingRole || '',
    status: row.status || '',
    team: row.team || '',
    soldPrice: row.soldprice === null || row.soldprice === undefined ? '' : Number(row.soldprice ?? row.soldPrice),
    auctionName: row.auctionname || row.auctionName || '',
  }));
}

export async function getDbPlayerByMobile(mobile: string): Promise<Player | null> {
  await ensureDbInitialized();
  const [rows] = await query('SELECT * FROM players WHERE mobile = ? OR uuid::text = ?', [mobile.trim(), mobile.trim()]);
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    uuid: row.uuid || '',
    timestamp: row.timestamp || '',
    name: row.name || '',
    mobile: row.mobile || '',
    playingAs: row.playingAs || row.playingas || '',
    playerPhoto: row.playerphoto || row.playerPhoto || '',
    playingRole: row.playingrole || row.playingRole || '',
    status: '',
    team: '',
    soldPrice: '',
    auctionName: '',
  };
}

export async function getDbPlayerByUuid(uuid: string): Promise<Player | null> {
  return getDbPlayerByMobile(uuid);
}

/** Players not yet assigned to the given auction pool (for add-to-pool UI). */
export async function getDbPlayersNotInAuction(auctionName: string): Promise<Player[]> {
  await ensureDbInitialized();
  const [aucResult] = await query('SELECT id FROM auctions WHERE name = ? OR uuid::text = ?', [auctionName, auctionName]);
  if (aucResult.length === 0) {
    const [qRows] = await query(
      `SELECT p.*, NULL as status, NULL as team, NULL as soldprice, NULL as auctionname FROM players p ORDER BY p.name`
    );
    return qRows.map((row: any) => ({
      id: row.id,
      uuid: row.uuid || '',
      timestamp: row.timestamp || '',
      name: row.name || '',
      mobile: row.mobile || '',
      playingAs: row.playingAs || row.playingas || '',
      playerPhoto: row.playerphoto || row.playerPhoto || '',
      playingRole: row.playingrole || row.playingRole || '',
      status: '',
      team: '',
      soldPrice: '',
      auctionName: '',
    }));
  }

  const auctionId = aucResult[0].id;
  const [qRows] = await query(
    `SELECT p.*, NULL as status, NULL as team, NULL as soldprice,
            (SELECT a.name FROM auction_players ap2
             INNER JOIN auctions a ON a.id = ap2.auctionid
             WHERE ap2.playerid = p.id AND ap2.auctionid <> ?
             LIMIT 1) as auctionname
     FROM players p
     WHERE p.id NOT IN (SELECT playerid FROM auction_players WHERE auctionid = ?)
     ORDER BY p.name`,
    [auctionId, auctionId]
  );

  return qRows.map((row: any) => ({
    id: row.id,
    uuid: row.uuid || '',
    timestamp: row.timestamp || '',
    name: row.name || '',
    mobile: row.mobile || '',
    playingAs: row.playingAs || row.playingas || '',
    playerPhoto: row.playerphoto || row.playerPhoto || '',
    playingRole: row.playingrole || row.playingRole || '',
    status: '',
    team: '',
    soldPrice: '',
    auctionName: row.auctionname || row.auctionName || '',
  }));
}

export async function updateDbPlayer(
  mobile: string,
  status: string,
  team: string,
  soldPrice: number | '',
  auctionName?: string
): Promise<void> {
  await ensureDbInitialized();
  const sqlSoldPrice = soldPrice === '' ? null : Number(soldPrice);

  const [playerResult] = await query('SELECT id FROM players WHERE mobile = ? OR uuid::text = ?', [mobile, mobile]);
  if (playerResult.length === 0) throw new Error(`Player with mobile or uuid ${mobile} not found`);
  const playerId = playerResult[0].id;

  let targetAuctionName = auctionName;
  if (!targetAuctionName) {
    const [actAuc] = await query("SELECT name FROM auctions WHERE status = 'Active' LIMIT 1");
    if (actAuc.length > 0) targetAuctionName = actAuc[0].name;
  }
  if (!targetAuctionName) throw new Error('No auction room specified or active to update player status.');

  const [aucResult] = await query('SELECT id FROM auctions WHERE name = ? OR uuid::text = ?', [targetAuctionName, targetAuctionName]);
  if (aucResult.length === 0) throw new Error(`Auction room ${targetAuctionName} not found`);
  const auctionId = aucResult[0].id;

  let teamId: number | null = null;
  if (team) {
    const [teamResult] = await query('SELECT id FROM teams WHERE name = ? OR uuid::text = ?', [team, team]);
    if (teamResult.length > 0) teamId = teamResult[0].id;
  }

  await query(
    `INSERT INTO auction_players (auctionId, playerId, status, teamId, soldPrice)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (auctionId, playerId) DO UPDATE SET
       status = EXCLUDED.status,
       teamId = EXCLUDED.teamId,
       soldPrice = EXCLUDED.soldPrice`,
    [auctionId, playerId, status, teamId, sqlSoldPrice]
  );
}

export async function addDbPlayer(player: any): Promise<void> {
  await ensureDbInitialized();
  const timestamp = new Date().toISOString();

  // If a uuid is provided, use it, otherwise let postgres generate it
  if (player.uuid) {
    await query(
      `INSERT INTO players (uuid, mobile, timestamp, name, playingAs, playerPhoto, playingRole)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        player.uuid, String(player.mobile).trim(), timestamp, String(player.name).trim(),
        String(player.playingAs || '').trim(), String(player.playerPhoto || '').trim(),
        String(player.playingRole || '').trim(),
      ]
    );
  } else {
    await query(
      `INSERT INTO players (mobile, timestamp, name, playingAs, playerPhoto, playingRole)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        String(player.mobile).trim(), timestamp, String(player.name).trim(),
        String(player.playingAs || '').trim(), String(player.playerPhoto || '').trim(),
        String(player.playingRole || '').trim(),
      ]
    );
  }

  const [playerResult] = await query('SELECT id FROM players WHERE mobile = ?', [String(player.mobile).trim()]);
  if (playerResult.length > 0) {
    const playerId = playerResult[0].id;
    const [auctionsRows] = await query('SELECT id FROM auctions');
    for (const auc of auctionsRows) {
      await query(
        `INSERT INTO auction_players (auctionId, playerId, status, teamId, soldPrice)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (auctionId, playerId) DO UPDATE SET
           status = EXCLUDED.status,
           teamId = EXCLUDED.teamId,
           soldPrice = EXCLUDED.soldPrice`,
        [auc.id, playerId, '', null, null]
      );
    }
  }
}

export async function updateFullDbPlayer(originalMobile: string, player: any): Promise<void> {
  await ensureDbInitialized();
  await query(
    `UPDATE players SET mobile = ?, name = ?, playingAs = ?, playerPhoto = ?, playingRole = ?
     WHERE mobile = ? OR uuid::text = ?`,
    [player.mobile, player.name, player.playingAs, player.playerPhoto, player.playingRole, originalMobile, originalMobile]
  );

  if (player.auctionName) {
    const [playerResult] = await query('SELECT id FROM players WHERE mobile = ? OR uuid::text = ?', [player.mobile, player.mobile]);
    if (playerResult.length > 0) {
      const playerId = playerResult[0].id;
      const [aucResult] = await query('SELECT id FROM auctions WHERE name = ? OR uuid::text = ?', [player.auctionName, player.auctionName]);
      if (aucResult.length > 0) {
        const auctionId = aucResult[0].id;
        let teamId: number | null = null;
        if (player.team) {
          const [teamResult] = await query('SELECT id FROM teams WHERE name = ? OR uuid::text = ?', [player.team, player.team]);
          if (teamResult.length > 0) teamId = teamResult[0].id;
        }
        const sqlSoldPrice =
          player.soldPrice === '' || player.soldPrice === undefined || player.soldPrice === null
            ? null
            : Number(player.soldPrice);
        await query(
          `INSERT INTO auction_players (auctionId, playerId, status, teamId, soldPrice)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (auctionId, playerId) DO UPDATE SET
             status = EXCLUDED.status,
             teamId = EXCLUDED.teamId,
             soldPrice = EXCLUDED.soldPrice`,
          [auctionId, playerId, player.status || '', teamId, sqlSoldPrice]
        );
      }
    }
  }
}

export async function updatePlayerAuction(mobile: string, auctionName: string): Promise<void> {
  await ensureDbInitialized();
  const normalizedMobile = mobile.trim();
  const [playerResult] = await query('SELECT id FROM players WHERE mobile = ? OR uuid::text = ?', [normalizedMobile, normalizedMobile]);
  const [aucResult] = await query('SELECT id, playersLimit FROM auctions WHERE name = ? OR uuid::text = ?', [auctionName, auctionName]);

  if (playerResult.length === 0) {
    throw new Error('Player not found');
  }
  if (aucResult.length === 0) {
    throw new Error(`Auction ${auctionName} not found`);
  }

  if (playerResult.length > 0 && aucResult.length > 0) {
    const playerId = playerResult[0].id;
    const auctionId = aucResult[0].id;
    const playersLimit = Number(aucResult[0].playerslimit ?? aucResult[0].playersLimit ?? 20);

    const [countResult] = await query(
      'SELECT COUNT(*)::int AS count FROM auction_players WHERE auctionId = ?',
      [auctionId]
    );
    const currentCount = countResult[0].count;

    const [checkMapping] = await query(
      'SELECT 1 FROM auction_players WHERE auctionId = ? AND playerId = ?',
      [auctionId, playerId]
    );

    if (checkMapping.length === 0 && currentCount >= playersLimit) {
      throw new Error(`Cannot add player. Players limit of ${playersLimit} reached for this auction.`);
    }

    await query(
      `INSERT INTO auction_players (auctionId, playerId, status, teamId, soldPrice)
       VALUES (?, ?, '', NULL, NULL)
       ON CONFLICT (auctionId, playerId) DO NOTHING`,
      [auctionId, playerId]
    );
  }
}

export async function removePlayerFromAuction(mobile: string, auctionName: string): Promise<void> {
  await ensureDbInitialized();
  const [playerResult] = await query('SELECT id FROM players WHERE mobile = ? OR uuid::text = ?', [mobile, mobile]);
  const [aucResult] = await query('SELECT id FROM auctions WHERE name = ? OR uuid::text = ?', [auctionName, auctionName]);

  if (playerResult.length > 0 && aucResult.length > 0) {
    await query('DELETE FROM auction_players WHERE auctionId = ? AND playerId = ?', [
      aucResult[0].id, playerResult[0].id,
    ]);
  }
}

export async function importPlayersFromBuffer(buffer: Buffer): Promise<{ count: number }> {
  await ensureDbInitialized();
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

  let importCount = 0;
  for (const row of rows) {
    const timestamp = row['Timestamp'] || row['timestamp'] || '';
    const name = row['Name'] || row['name'] || row['Player Name'] || row['player name'] || '';
    const mobile = row['Mobile No.'] || row['mobile'] || row['Mobile'] || row['Mobile Number'] || '';
    const playingAs = row['Playing As'] || row['playingAs'] || row['playing as'] || '';
    const playerPhoto = row['Photo link'] || row['playerPhoto'] || row['photo'] || row['Player Photo'] || '';
    const playingRole = row['Playing Role'] || row['playingRole'] || row['role'] || row['Role'] || '';
    const status = row['Status'] || row['status'] || '';
    const team = row['Team'] || row['team'] || null;
    const soldPrice = row['Sold Price'] || row['soldPrice'] || row['price'] || null;

    if (!mobile || !name) continue;

    const sqlSoldPrice = soldPrice === null || soldPrice === '' ? null : Number(soldPrice);

    await query(
      `INSERT INTO players (mobile, timestamp, name, playingAs, playerPhoto, playingRole)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (mobile) DO UPDATE SET
         timestamp = EXCLUDED.timestamp,
         name = EXCLUDED.name,
         playingAs = EXCLUDED.playingAs,
         playerPhoto = EXCLUDED.playerPhoto,
         playingRole = EXCLUDED.playingRole`,
      [String(mobile).trim(), String(timestamp), String(name).trim(), String(playingAs), String(playerPhoto), String(playingRole)]
    );

    const [playerResult] = await query('SELECT id FROM players WHERE mobile = ?', [String(mobile).trim()]);
    if (playerResult.length > 0) {
      const playerId = playerResult[0].id;
      const [auctionsRows] = await query('SELECT id, name FROM auctions');
      for (const auc of auctionsRows) {
        let teamId: number | null = null;
        if (team) {
          const [teamResult] = await query('SELECT id FROM teams WHERE name = ?', [team]);
          if (teamResult.length > 0) teamId = teamResult[0].id;
        }
        await query(
          `INSERT INTO auction_players (auctionId, playerId, status, teamId, soldPrice)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (auctionId, playerId) DO UPDATE SET
             status = EXCLUDED.status,
             teamId = EXCLUDED.teamId,
             soldPrice = EXCLUDED.soldPrice`,
          [auc.id, playerId, String(status), teamId, sqlSoldPrice]
        );
      }
    }
    importCount++;
  }

  return { count: importCount };
}

export async function getDbTeams(auctionName?: string): Promise<Team[]> {
  await ensureDbInitialized();

  let targetAuctionName = auctionName;
  if (!targetAuctionName) {
    const [actAuc] = await query("SELECT name FROM auctions WHERE status = 'Active' LIMIT 1");
    if (actAuc.length > 0) targetAuctionName = actAuc[0].name;
  }

  let rows: any[] = [];
  if (targetAuctionName) {
    const [aucRows] = await query('SELECT id FROM auctions WHERE name = ? OR uuid::text = ?', [targetAuctionName, targetAuctionName]);
    if (aucRows.length > 0) {
      const auctionId = aucRows[0].id;
      const [tRows] = await query(
        `SELECT t.*, COALESCE(at.budget, t.budget) as budget
         FROM teams t
         LEFT JOIN auction_teams at ON t.id = at.teamId AND at.auctionId = ?`,
        [auctionId]
      );
      rows = tRows;
    } else {
      const [tRows] = await query('SELECT * FROM teams');
      rows = tRows;
    }
  } else {
    const [tRows] = await query('SELECT * FROM teams');
    rows = tRows;
  }

  return rows.map((row) => ({
    id: row.id,
    uuid: row.uuid || '',
    name: row.name,
    owner: row.owner,
    budget: Number(row.budget),
    logo: row.logo,
    captain: row.captain,
    captainMobile: row.captainmobile || row.captainMobile || '',
    passcode: row.passcode || '',
  }));
}

export async function updateDbTeamBudget(teamName: string, auctionName: string, budget: number): Promise<void> {
  await ensureDbInitialized();

  const [teamResult] = await query('SELECT id FROM teams WHERE name = ? OR uuid::text = ?', [teamName, teamName]);
  if (teamResult.length === 0) throw new Error(`Team ${teamName} not found`);
  const teamId = teamResult[0].id;

  const [aucResult] = await query('SELECT id FROM auctions WHERE name = ? OR uuid::text = ?', [auctionName, auctionName]);
  if (aucResult.length === 0) throw new Error(`Auction ${auctionName} not found`);
  const auctionId = aucResult[0].id;

  await query(
    `INSERT INTO auction_teams (auctionId, teamId, budget)
     VALUES (?, ?, ?)
     ON CONFLICT (auctionId, teamId) DO UPDATE SET budget = EXCLUDED.budget`,
    [auctionId, teamId, budget]
  );
}

export async function addDbTeam(team: Team): Promise<void> {
  await ensureDbInitialized();
  if (team.uuid) {
    await query(
      `INSERT INTO teams (uuid, name, owner, budget, logo, captain, captainMobile, passcode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [team.uuid, team.name, team.owner, team.budget, team.logo, team.captain || '', team.captainMobile || '', team.passcode || '']
    );
  } else {
    await query(
      `INSERT INTO teams (name, owner, budget, logo, captain, captainMobile, passcode)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [team.name, team.owner, team.budget, team.logo, team.captain || '', team.captainMobile || '', team.passcode || '']
    );
  }
}

export async function updateFullDbTeam(originalName: string, team: Team): Promise<void> {
  await ensureDbInitialized();

  await query(
    `UPDATE teams SET name = ?, owner = ?, logo = ?, passcode = ? WHERE name = ? OR uuid::text = ?`,
    [team.name.trim(), team.owner ? team.owner.trim() : '', team.logo ? team.logo.trim() : '', team.passcode ? team.passcode.trim() : '', originalName, originalName]
  );
}

export async function updateDbTeamCaptain(teamName: string, captain: string, captainMobile: string): Promise<void> {
  await ensureDbInitialized();
  await query('UPDATE teams SET captain = ?, captainMobile = ? WHERE name = ? OR uuid::text = ?', [captain, captainMobile, teamName, teamName]);
}

export async function getDbAuctions(): Promise<Auction[]> {
  await ensureDbInitialized();
  const teamsList = await getDbTeams();

  const [rows] = await query(
    `SELECT a.*, p.mobile as activePlayerMobile, t.name as currentBidderTeam
     FROM auctions a
     LEFT JOIN players p ON a.activePlayerId = p.id
     LEFT JOIN teams t ON a.currentBidderTeamId = t.id`
  );

  return rows.map((row) => {
    let parsedTeams: string[] = [];
    try {
      if (row.teams) {
        const teamIds = JSON.parse(row.teams);
        if (Array.isArray(teamIds)) {
          parsedTeams = teamIds.map((tId) => teamsList.find((t) => t.id === Number(tId))?.name || '').filter(Boolean);
        } else {
          parsedTeams = String(row.teams).split(',').map((t: string) => t.trim()).filter(Boolean);
        }
      }
    } catch {
      parsedTeams = row.teams ? String(row.teams).split(',').map((t: string) => t.trim()).filter(Boolean) : [];
    }

    return {
      id: row.id,
      uuid: row.uuid || '',
      name: row.name,
      status: row.status as 'Active' | 'Draft' | 'Completed',
      teams: parsedTeams,
      activePlayerMobile: row.activeplayermobile || row.activePlayerMobile || '',
      currentBidPrice: Number(row.currentbidprice ?? row.currentBidPrice ?? 0),
      currentBidderTeam: row.currentbidderteam || row.currentBidderTeam || '',
      timerEndsAt: row.timerendsat || row.timerEndsAt || null,
      playersLimit: Number(row.playerslimit ?? row.playersLimit ?? 20),
      timerDuration: Number(row.timerduration ?? row.timerDuration ?? 120),
      isPaused: Boolean(row.ispaused ?? row.isPaused),
      pausedTimeRemaining:
        row.pausedtimeremaining !== null && row.pausedtimeremaining !== undefined
          ? Number(row.pausedtimeremaining)
          : row.pausedTimeRemaining !== null && row.pausedTimeRemaining !== undefined
            ? Number(row.pausedTimeRemaining)
            : null,
    };
  });
}

export async function updateDbAuction(auction: Auction): Promise<void> {
  await ensureDbInitialized();

  let activePlayerId: number | null = null;
  if (auction.activePlayerMobile) {
    const [playerResult] = await query('SELECT id FROM players WHERE mobile = ? OR uuid::text = ?', [auction.activePlayerMobile, auction.activePlayerMobile]);
    if (playerResult.length > 0) activePlayerId = playerResult[0].id;
  }

  let currentBidderTeamId: number | null = null;
  if (auction.currentBidderTeam) {
    const [teamResult] = await query('SELECT id FROM teams WHERE name = ? OR uuid::text = ?', [auction.currentBidderTeam, auction.currentBidderTeam]);
    if (teamResult.length > 0) currentBidderTeamId = teamResult[0].id;
  }

  const teamIds: number[] = [];
  if (auction.teams && auction.teams.length > 0) {
    for (const tName of auction.teams) {
      const [teamResult] = await query('SELECT id FROM teams WHERE name = ? OR uuid::text = ?', [tName, tName]);
      if (teamResult.length > 0) teamIds.push(teamResult[0].id);
    }
  }

  await query(
    `UPDATE auctions SET
       status = ?, teams = ?, activePlayerId = ?, currentBidPrice = ?,
       currentBidderTeamId = ?, timerEndsAt = ?, playersLimit = ?,
       timerDuration = ?, isPaused = ?, pausedTimeRemaining = ?
     WHERE name = ? OR uuid::text = ?`,
    [
      auction.status, JSON.stringify(teamIds), activePlayerId, auction.currentBidPrice,
      currentBidderTeamId, auction.timerEndsAt || null,
      auction.playersLimit !== undefined ? Number(auction.playersLimit) : 20,
      auction.timerDuration !== undefined ? Number(auction.timerDuration) : 120,
      auction.isPaused ?? false,
      auction.pausedTimeRemaining !== undefined ? auction.pausedTimeRemaining : null,
      auction.name,
      auction.uuid || auction.name,
    ]
  );
}

export async function addDbAuction(auction: Auction): Promise<void> {
  await ensureDbInitialized();

  let activePlayerId: number | null = null;
  if (auction.activePlayerMobile) {
    const [playerResult] = await query('SELECT id FROM players WHERE mobile = ? OR uuid::text = ?', [auction.activePlayerMobile, auction.activePlayerMobile]);
    if (playerResult.length > 0) activePlayerId = playerResult[0].id;
  }

  let currentBidderTeamId: number | null = null;
  if (auction.currentBidderTeam) {
    const [teamResult] = await query('SELECT id FROM teams WHERE name = ? OR uuid::text = ?', [auction.currentBidderTeam, auction.currentBidderTeam]);
    if (teamResult.length > 0) currentBidderTeamId = teamResult[0].id;
  }

  const teamIds: number[] = [];
  if (auction.teams && auction.teams.length > 0) {
    for (const tName of auction.teams) {
      const [teamResult] = await query('SELECT id FROM teams WHERE name = ? OR uuid::text = ?', [tName, tName]);
      if (teamResult.length > 0) teamIds.push(teamResult[0].id);
    }
  }

  if (auction.uuid) {
    await query(
      `INSERT INTO auctions (uuid, name, status, teams, activePlayerId, currentBidPrice, currentBidderTeamId, timerEndsAt, playersLimit, timerDuration, isPaused, pausedTimeRemaining)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        auction.uuid, auction.name, auction.status, JSON.stringify(teamIds), activePlayerId,
        auction.currentBidPrice, currentBidderTeamId, auction.timerEndsAt || null,
        auction.playersLimit !== undefined ? Number(auction.playersLimit) : 20,
        auction.timerDuration !== undefined ? Number(auction.timerDuration) : 120,
        auction.isPaused ?? false,
        auction.pausedTimeRemaining !== undefined ? auction.pausedTimeRemaining : null,
      ]
    );
  } else {
    await query(
      `INSERT INTO auctions (name, status, teams, activePlayerId, currentBidPrice, currentBidderTeamId, timerEndsAt, playersLimit, timerDuration, isPaused, pausedTimeRemaining)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        auction.name, auction.status, JSON.stringify(teamIds), activePlayerId,
        auction.currentBidPrice, currentBidderTeamId, auction.timerEndsAt || null,
        auction.playersLimit !== undefined ? Number(auction.playersLimit) : 20,
        auction.timerDuration !== undefined ? Number(auction.timerDuration) : 120,
        auction.isPaused ?? false,
        auction.pausedTimeRemaining !== undefined ? auction.pausedTimeRemaining : null,
      ]
    );
  }
}

export async function deleteDbAuction(name: string): Promise<void> {
  await ensureDbInitialized();
  await query('DELETE FROM auctions WHERE name = ? OR uuid::text = ?', [name, name]);
}

export async function updateDbAuctionName(oldName: string, newName: string): Promise<void> {
  await ensureDbInitialized();
  await query('UPDATE auctions SET name = ? WHERE name = ? OR uuid::text = ?', [newName, oldName, oldName]);
}

export async function verifyDbAdmin(username: string, passwordPassed: string): Promise<boolean> {
  await ensureDbInitialized();
  const [rows] = await query('SELECT * FROM admins WHERE username = ? AND password = ?', [username, passwordPassed]);
  return rows.length > 0;
}

export async function updateDbAdminPassword(username: string, newPasswordPassed: string): Promise<void> {
  await ensureDbInitialized();
  await query('UPDATE admins SET password = ? WHERE username = ?', [newPasswordPassed.trim(), username.trim()]);
}

export async function getPlayerAuctionHistory(mobile: string): Promise<any[]> {
  await ensureDbInitialized();
  const [rows] = await query(
    `SELECT a.name as auctionName, a.status as auctionStatus, ap.status as playerStatus, t.name as teamName, ap.soldPrice
     FROM players p
     JOIN auction_players ap ON p.id = ap.playerId
     JOIN auctions a ON ap.auctionId = a.id
     LEFT JOIN teams t ON ap.teamId = t.id
     WHERE p.mobile = ? OR p.uuid::text = ?`,
    [mobile, mobile]
  );

  return rows.map((row) => ({
    auctionName: row.auctionname || row.auctionName,
    auctionStatus: row.auctionstatus || row.auctionStatus,
    status: row.playerstatus || row.playerStatus || 'Available',
    team: row.teamname || row.teamName || '',
    soldPrice: row.soldprice === null || row.soldprice === undefined ? '' : Number(row.soldprice ?? row.soldPrice),
  }));
}
