# System Architecture — Swedish Racket Sports Booking Ecosystem

Reference document derived from the business plan. This serves as the single source of truth
for architectural decisions and implementation protocol.

---

## Market Context

The Swedish padel/tennis market has matured post-boom (650K+ players, 45% growth 2022-2024).
Over 100 facilities closed due to oversupply. Surviving clubs must maximize court utilization,
drive retention via social features, and reduce overhead through facility automation.

Competitors: **Matchi** (Nordic club admin focus), **Playtomic** (global, gamified/Elo-driven).
Our platform synthesizes both approaches.

---

## Monorepo Structure

```
racket-booking/
├── apps/
│   ├── api/          # Node.js + Express + TypeScript backend
│   ├── mobile/       # React Native (Expo) player app
│   └── admin/        # Next.js club administration portal
├── packages/
│   ├── shared/       # Shared TS interfaces, types, constants
│   └── db/           # PostgreSQL schema, migrations, seed data
├── .github/workflows/ # CI/CD (GitHub Actions with monorepo change detection)
├── docs/             # Architecture docs, business plan reference
└── scripts/          # Build, deploy, utility scripts
```

---

## Database Layer (PostgreSQL)

### Core Tables
- **clubs** — facility operators (commercial or non-profit association)
- **courts** — individual courts with sport type, pricing, IoT hardware mapping
- **users** — players with Elo ratings per sport
- **bookings** — reservations using `tsrange` with `EXCLUDE USING gist` constraint
- **split_payments** — multi-party payment tracking per booking

### Double-Booking Prevention
Uses `tsrange` + `EXCLUDE USING gist` constraint (NOT application-level locking):
```sql
CONSTRAINT prevent_double_booking EXCLUDE USING gist (
  court_id WITH =,
  time_slot WITH &&
) WHERE (status != 'cancelled')
```
Requires `btree_gist` extension. PostgreSQL error code `23P04` on violation.

Boundary convention: `[start, end)` — inclusive start, exclusive end — so a booking
ending at 14:00 does not conflict with one starting at 14:00.

---

## Swedish VAT Routing

| Transaction Type        | Entity Status        | VAT Rate | Routing                              |
|------------------------|---------------------|----------|--------------------------------------|
| Court Rental           | Commercial (AB)     | 6%       | Standard split payout to club        |
| Court Rental           | Non-Profit (Ideell) | 0%       | Tax-exempt; 90% non-profit validation|
| Platform Convenience   | All                 | 25%      | Retained by platform                 |
| SaaS License Fee       | Commercial (AB)     | 25%      | B2B invoice from platform            |

---

## Payment Infrastructure

### Payment Rails
1. **Stripe Connect** — primary processor, "Separate Charges and Transfers" model
2. **Swish** — Swedish mobile payments (m-commerce API via Trustly), Mobile BankID auth
3. **Klarna** — installments for memberships (Checkout API)

### Split Payment Algorithm (Padel = 4 players)
1. Player A books (400 SEK). Pays their 100 SEK share + authorizes hold for remaining 300 SEK
2. Players B, C, D receive deep links → pay 100 SEK each via Stripe Checkout or Swish
3. Backend listens to `payment_intent.succeeded` webhooks, marks `split_payments` as paid
4. If all pay before cutoff (2h before match): release hold on Player A
5. If any fail to pay: capture outstanding balance from Player A's hold
6. Transfer funds (minus platform fee + 25% VAT on fee) to club's Stripe Express account

---

## Elo Rating System

### Formula
- Expected probability: `P_A = 1 / (1 + 10^((R_B - R_A) / 400))`
- Rating update: `R_new = R_old + K * (S - P)` where S=1 (win), 0 (loss), 0.5 (draw)

### Dynamic K-Factors
- Rating < 2100: K = 32 (new players converge fast)
- 2100-2400: K = 24
- Rating > 2400: K = 16 (stable for experienced players)

### Doubles Adaptation (Padel)
- Team rating = arithmetic mean of both players
- Expected outcome computed from team ratings
- Individual updates applied using team expected/actual values
- Optional: score margin multiplier (6-0 yields more points than 7-6)

---

## Tournament Engine — Padel Americano

### Format
- Round-robin doubles: every player partners with every other player exactly once
- Points scored individually (e.g., matches to 32 total points)
- Optimal for N players where N % 4 === 0 (8, 12, 16 players)
- Generates N-1 rounds

### Algorithm (Berger/Whist Rotation)
1. Fix Player 1 as pivot
2. Remaining N-1 players form circular array
3. Each round: pair opposite ends of array for matches
4. Rotate array clockwise after each round
5. Handle non-multiples of 4 with "bye" system

---

## IoT Facility Automation

### Access Control
- Generate ephemeral PIN on booking confirmation (secure random, 4-6 digits)
- Dispatch to physical door keypad API (e.g., Codelocks)
- Temporal validation: PIN valid from 30min before → 15min after booking

### Lighting Control
- Map `court_id` → `hardware_relay_id`
- Schedule via Redis-backed BullMQ job queue:
  - RELAY_ON: 5 minutes before booking start
  - RELAY_OFF: at booking end time
- Retry with exponential backoff on hardware API failures

---

## Frontend Architecture

### Mobile App (React Native / Expo)
- Cross-platform iOS + Android from single codebase
- Calendar UI via `wix/react-native-calendars`
- Real-time availability sync via REST/GraphQL
- Deep links for Swish payments and split payment invites

### Admin Portal (Next.js)
- Club management dashboard
- Court configuration + pricing rules
- Financial reporting with VAT breakdown
- Booking overview + manual overrides
- IoT hardware status monitoring

---

## CI/CD (GitHub Actions)

- Monorepo change detection via `dorny/paths-filter`
- Conditional builds: only rebuild modified packages
- Mobile: macOS runner for iOS (Xcode/CocoaPods), Ubuntu for Android (Gradle)
- Backend: run constraint + logic tests → deploy to cloud
- Artifacts: .ipa/.apk → Firebase App Distribution / TestFlight

---

## Implementation Priority

### Phase 1 — Core Platform
1. Database schema + migrations
2. Booking API with double-booking prevention
3. Single payment flow (Stripe)
4. Basic court availability calendar
5. Club admin CRUD

### Phase 2 — Social & Payments
6. Split payment implementation
7. Elo rating system
8. Public match listings / matchmaking
9. Swish integration

### Phase 3 — Automation & Events
10. IoT facility automation (access PINs, lighting)
11. Padel Americano tournament engine
12. Push notifications

### Phase 4 — Scale & Polish
13. Klarna for memberships
14. Dynamic pricing engine
15. CI/CD pipeline hardening
16. App store deployment
