/**
 * Simple sequential migration runner.
 * Reads .sql files from ./migrations in order and executes them.
 * Tracks applied migrations in a `_migrations` table.
 *
 * Usage: DATABASE_URL=... node migrate.js
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function migrate() {
  // Prefer DATABASE_URL_DIRECT (port 5432, session mode) when available.
  // Supabase's transaction pooler (port 6543) is fine for app code but
  // rejects some DDL — always run migrations against the direct connection.
  const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL (or DATABASE_URL_DIRECT) is not set.');
    process.exit(1);
  }
  const client = new Client({ connectionString });
  await client.connect();

  // Ensure migration tracking table exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get already applied migrations
  const { rows: applied } = await client.query('SELECT name FROM _migrations ORDER BY name');
  const appliedSet = new Set(applied.map(r => r.name));

  // Read migration files in order
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  skip: ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`  apply: ${file}`);

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      count++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  FAILED: ${file}`, err.message);
      process.exit(1);
    }
  }

  console.log(`\nMigrations complete. ${count} new migration(s) applied.`);
  await client.end();
}

migrate().catch(err => {
  console.error('Migration runner failed:', err);
  process.exit(1);
});
