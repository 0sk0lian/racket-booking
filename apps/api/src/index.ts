import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import { clubRoutes } from './routes/clubs.js';
import { courtRoutes } from './routes/courts.js';
import { bookingRoutes } from './routes/bookings.js';
import { userRoutes } from './routes/users.js';
import { matchRoutes } from './routes/matches.js';
import { tournamentRoutes } from './routes/tournaments.js';
import { webhookRoutes } from './routes/webhooks.js';
import { statsRoutes } from './routes/stats.js';
import { adminRoutes } from './routes/admin.js';
import { weeklyRoutes } from './routes/weekly.js';
import { trainerAdminRoutes } from './routes/trainers.js';
import { featuresRoutes } from './routes/features.js';
import { matchiRoutes } from './routes/matchi.js';
import { trainingPlannerRoutes } from './routes/training-planner.js';
import { registrationFormRoutes } from './routes/registration-forms.js';

dotenv.config({ path: '../../.env' });

const app = express();
const PORT = process.env.PORT || 3001;

// Stripe webhooks need raw body — mount before json middleware
app.use('/api/webhooks', webhookRoutes);

app.use(helmet());
app.use(cors());
app.use(express.json());

// Root landing page
app.get('/', (_req, res) => {
  res.send(`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Racket Booking API</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#f6f8fb;color:#0f172a;min-height:100vh;-webkit-font-smoothing:antialiased}
.c{max-width:860px;margin:0 auto;padding:48px 24px;position:relative;z-index:1}
.hd{text-align:center;margin-bottom:56px}
.hd h1{font-size:42px;font-weight:800;letter-spacing:-1.5px;background:linear-gradient(135deg,#6366f1,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hd p{color:#64748b;margin-top:8px;font-size:17px}
.st{display:inline-flex;align-items:center;gap:8px;background:#fff;border:1px solid #e2e8f0;padding:8px 18px;border-radius:24px;margin-top:20px;font-size:13px;font-weight:500;box-shadow:0 1px 3px rgba(0,0,0,.06);color:#334155}
.st .d{width:8px;height:8px;background:#10b981;border-radius:50%;box-shadow:0 0 6px rgba(16,185,129,.4);animation:p 2s infinite}
@keyframes p{0%,100%{opacity:1}50%{opacity:.4}}
.gr{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:36px}
.cd{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:22px;transition:all .3s cubic-bezier(.34,1.56,.64,1);position:relative;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.cd::after{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#6366f1,#06b6d4);opacity:0;transition:opacity .25s}
.cd:hover{transform:translateY(-4px);box-shadow:0 10px 40px rgba(0,0,0,.08);border-color:#a5b4fc}
.cd:hover::after{opacity:1}
.cd h3{font-size:15px;font-weight:600;color:#0f172a;margin-bottom:6px}
.cd p{font-size:12.5px;color:#64748b;line-height:1.6}
.ep{margin-top:48px}
.ep h2{font-size:18px;font-weight:700;margin-bottom:14px;color:#0f172a;letter-spacing:-.3px}
.en{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:11px 16px;margin-bottom:6px;display:flex;align-items:center;gap:12px;font-size:13px;transition:all .2s;box-shadow:0 1px 2px rgba(0,0,0,.03)}
.en:hover{border-color:#a5b4fc;transform:translateX(4px)}
.m{font-weight:700;font-size:10.5px;padding:3px 8px;border-radius:5px;min-width:48px;text-align:center;letter-spacing:.3px;border:1px solid transparent}
.ge{background:#ecfdf5;color:#059669;border-color:#a7f3d0}
.po{background:#eff6ff;color:#2563eb;border-color:#bfdbfe}
.pa{background:#fffbeb;color:#d97706;border-color:#fde68a}
.de{background:#fef2f2;color:#dc2626;border-color:#fecaca}
.pt{color:#334155;font-family:'SF Mono',Monaco,'Cascadia Code',monospace;font-size:12.5px}
.ds{color:#94a3b8;margin-left:auto;font-size:11.5px}
.ft{text-align:center;margin-top:56px;padding-top:24px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12.5px}
a{color:#6366f1;text-decoration:none}a:hover{color:#4f46e5}
</style></head><body><div class="c">
<div class="hd"><h1>Racket Booking</h1><p>Swedish Racket Sports Booking Ecosystem</p><div class="st"><span class="d"></span> API Online</div></div>
<div class="gr">
<div class="cd"><h3>Court Booking</h3><p>Real-time availability with PostgreSQL exclusion constraints preventing double-bookings.</p></div>
<div class="cd"><h3>Split Payments</h3><p>Stripe Connect multi-party payments. 4 players split a padel court seamlessly.</p></div>
<div class="cd"><h3>Elo Ratings</h3><p>Skill-based matchmaking with dynamic K-factors. Singles and doubles support.</p></div>
<div class="cd"><h3>Tournaments</h3><p>Americano and Mexicano generators using Berger table rotation logic.</p></div>
<div class="cd"><h3>IoT Automation</h3><p>Ephemeral access PINs and court lighting control for unmanned 24/7 facilities.</p></div>
<div class="cd"><h3>Swedish VAT</h3><p>6% court rental, 0% non-profit, 25% platform fees. Skatteverket compliant.</p></div>
</div>
<div class="ep"><h2>Endpoints</h2>
<div class="en"><span class="m ge">GET</span><span class="pt">/api/health</span><span class="ds">Health check</span></div>
<div class="en"><span class="m ge">GET</span><span class="pt">/api/clubs</span><span class="ds">List clubs</span></div>
<div class="en"><span class="m ge">GET</span><span class="pt">/api/courts</span><span class="ds">List courts</span></div>
<div class="en"><span class="m ge">GET</span><span class="pt">/api/courts/:id/availability</span><span class="ds">Court schedule</span></div>
<div class="en"><span class="m po">POST</span><span class="pt">/api/bookings</span><span class="ds">Create booking</span></div>
<div class="en"><span class="m pa">PATCH</span><span class="pt">/api/bookings/:id/cancel</span><span class="ds">Cancel booking</span></div>
<div class="en"><span class="m po">POST</span><span class="pt">/api/users/register</span><span class="ds">Register</span></div>
<div class="en"><span class="m po">POST</span><span class="pt">/api/users/login</span><span class="ds">Login</span></div>
<div class="en"><span class="m ge">GET</span><span class="pt">/api/users/leaderboard</span><span class="ds">Elo rankings</span></div>
<div class="en"><span class="m po">POST</span><span class="pt">/api/matches</span><span class="ds">Record match</span></div>
<div class="en"><span class="m po">POST</span><span class="pt">/api/tournaments</span><span class="ds">Create tournament</span></div>
<div class="en"><span class="m ge">GET</span><span class="pt">/api/stats/overview</span><span class="ds">Platform analytics</span></div>
<div class="en"><span class="m ge">GET</span><span class="pt">/api/stats/player/:id</span><span class="ds">Player stats</span></div>
<div class="en"><span class="m ge">GET</span><span class="pt">/api/admin/schedule</span><span class="ds">Admin schedule grid</span></div>
<div class="en"><span class="m po">POST</span><span class="pt">/api/admin/bookings/bulk</span><span class="ds">Bulk create bookings</span></div>
<div class="en"><span class="m de">DELETE</span><span class="pt">/api/admin/bookings/:id</span><span class="ds">Admin cancel</span></div>
</div>
<div class="ft"><p>Racket Booking v0.1.0 &mdash; <a href="/api/health">/api/health</a> &mdash; <a href="http://localhost:3002">Admin Portal</a></p></div>
</div></body></html>`);
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/clubs', clubRoutes);
app.use('/api/courts', courtRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/weekly', weeklyRoutes);
app.use('/api/admin/trainer-management', trainerAdminRoutes);
app.use('/api/features', featuresRoutes);
app.use('/api/matchi', matchiRoutes);
app.use('/api/training-planner', trainingPlannerRoutes);
app.use('/api/registration-forms', registrationFormRoutes);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[api] Server running on port ${PORT}`);
});

export default app;
