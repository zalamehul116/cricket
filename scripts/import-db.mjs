/**
 * Import JSON data into PostgreSQL.
 * Usage: node --env-file=.env.local scripts/import-db.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createPool } from './db-config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data-export');

const DELETE_ORDER = ['auction_players', 'auction_teams', 'auctions', 'players', 'teams', 'admins'];
const IMPORT_ORDER = ['teams', 'players', 'auctions', 'auction_teams', 'auction_players', 'admins'];

async function main() {
  const pool = createPool();
  const schemaPath = path.join(__dirname, 'schema.sql');
  await pool.query(fs.readFileSync(schemaPath, 'utf8'));
  console.log('Schema ready.\n');

  for (const table of DELETE_ORDER) {
    await pool.query(`DELETE FROM ${table}`);
  }

  for (const table of IMPORT_ORDER) {
    const file = path.join(DATA_DIR, `${table}.json`);
    if (!fs.existsSync(file)) {
      console.log(`  ${table}: no export file, skipped`);
      continue;
    }
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!rows.length) {
      console.log(`  ${table}: 0 rows, skipped`);
      continue;
    }

    const columns = Object.keys(rows[0]).map((c) => c.toLowerCase());
    const colList = columns.map((c) => `"${c}"`).join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    for (const row of rows) {
      const values = Object.keys(rows[0]).map((col) => row[col]);
      await pool.query(`INSERT INTO ${table} (${colList}) VALUES (${placeholders})`, values);
    }
    console.log(`  ${table}: ${rows.length} rows imported`);
  }

  for (const table of IMPORT_ORDER) {
    await pool.query(`
      SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))
    `);
  }

  await pool.end();
  console.log('\nImport complete!');
}

main().catch((err) => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
