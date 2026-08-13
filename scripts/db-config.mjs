import pg from 'pg';

export function getPoolConfig() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required in .env.local');
  }

  const needsSsl =
    connectionString.includes('sslmode=require') ||
    connectionString.includes('sslmode=verify-full') ||
    /neon\.tech|supabase\.co/.test(connectionString);

  return {
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  };
}

export function createPool() {
  return new pg.Pool(getPoolConfig());
}
