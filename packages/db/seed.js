/**
 * Minimal seed for a fresh Supabase database.
 *
 * Creates the smallest amount of data needed for the admin app to render
 * something other than empty states:
 *   - 1 club (Stockholm Padel Arena)
 *   - 1 venue profile for the club
 *   - 3 courts (2 indoor padel, 1 outdoor padel)
 *
 * No users are seeded. Sign up via the Supabase Auth login UI in the admin
 * app — the FIRST signup is automatically promoted to 'admin' by the trigger
 * in migration 030. Subsequent signups default to 'player'.
 *
 * Idempotent: detects an existing seed by `clubs.organization_number` and
 * exits cleanly if it's already there. Safe to re-run.
 *
 * Usage:
 *   DATABASE_URL_DIRECT=postgres://... node packages/db/seed.js
 */
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const SEED_ORG_NUMBER = '559123-0001';

async function seed() {
  const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL (or DATABASE_URL_DIRECT) not set. Aborting seed.');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  // Idempotency guard
  const existing = await client.query('SELECT id FROM clubs WHERE organization_number = $1', [SEED_ORG_NUMBER]);
  if (existing.rows.length > 0) {
    console.log(`  skip: club ${SEED_ORG_NUMBER} already seeded (id=${existing.rows[0].id})`);
    await client.end();
    return;
  }

  await client.query('BEGIN');
  try {
    // ─── Club ─────────────────────────────────────────────────
    const clubRes = await client.query(
      `INSERT INTO clubs (name, organization_number, is_non_profit, timezone, contact_email, city)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      ['Stockholm Padel Arena', SEED_ORG_NUMBER, false, 'Europe/Stockholm', 'info@stockholmpadel.local', 'Stockholm'],
    );
    const clubId = clubRes.rows[0].id;
    console.log(`  insert: club ${clubId}`);

    // ─── Venue profile ────────────────────────────────────────
    await client.query(
      `INSERT INTO venue_profiles (club_id, description, amenities, opening_hours, booking_rules, social_links)
       VALUES ($1, $2, $3::text[], $4::jsonb, $5::jsonb, $6::jsonb)`,
      [
        clubId,
        'Three padel courts in central Stockholm. Open 07-22 every day.',
        ['omklädningsrum', 'parkering', 'café'],
        JSON.stringify(Array.from({ length: 7 }, (_, day) => ({ day, open: '07:00', close: '22:00' }))),
        JSON.stringify({
          max_days_ahead: 14,
          cancellation_hours: 24,
          refund_percentage: 100,
          max_bookings_per_user: null,
          show_names_in_schedule: true,
        }),
        JSON.stringify({ website: 'https://stockholmpadel.local' }),
      ],
    );

    // ─── Courts ───────────────────────────────────────────────
    const courts = [
      ['Padel Bana 1', 'padel', true,  400.00],
      ['Padel Bana 2', 'padel', true,  400.00],
      ['Padel Bana 3 (Utomhus)', 'padel', false, 300.00],
    ];
    for (const [name, sport_type, is_indoor, base_hourly_rate] of courts) {
      const r = await client.query(
        `INSERT INTO courts (club_id, name, sport_type, is_indoor, base_hourly_rate, is_active)
         VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id`,
        [clubId, name, sport_type, is_indoor, base_hourly_rate],
      );
      console.log(`  insert: court ${r.rows[0].id} (${name})`);
    }

    await client.query('COMMIT');
    console.log('\nSeed complete.');
    console.log('  Next: open the admin app, click "Sign up", create your account.');
    console.log('  The first signup is auto-promoted to admin by migration 030.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed().catch(err => {
  console.error('Seed runner failed:', err);
  process.exit(1);
});
