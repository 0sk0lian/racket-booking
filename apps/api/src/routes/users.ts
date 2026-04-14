import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { store } from '../store.js';
import { authenticate, generateToken } from '../middleware/auth.js';

export const userRoutes = Router();

userRoutes.post('/register', async (req: Request, res: Response) => {
  const { email, fullName, phoneNumber, password } = req.body;
  if (!email || !fullName || !password) {
    res.status(400).json({ success: false, error: 'email, fullName, and password are required' });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = store.createUser({ email, password_hash: passwordHash, full_name: fullName, phone_number: phoneNumber ?? null });
    const { password_hash, ...safeUser } = user;
    const token = generateToken({ userId: user.id, email: user.email });
    res.status(201).json({ success: true, data: { user: safeUser, token } });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ success: false, error: 'Email already registered' });
      return;
    }
    throw err;
  }
});

userRoutes.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = store.users.find(u => u.email === email && u.is_active);

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ success: false, error: 'Invalid email or password' });
    return;
  }

  const token = generateToken({ userId: user.id, email: user.email });
  const { password_hash, ...safeUser } = user;
  res.json({ success: true, data: { user: safeUser, token } });
});

userRoutes.get('/me', authenticate, (req: Request, res: Response) => {
  const user = store.users.find(u => u.id === req.user!.userId);
  if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }
  const { password_hash, ...safeUser } = user;
  res.json({ success: true, data: safeUser });
});

userRoutes.get('/', (_req: Request, res: Response) => {
  const users = store.users.filter(u => u.is_active).map(u => {
    const { password_hash, ...safe } = u;
    return safe;
  });
  res.json({ success: true, data: users });
});

userRoutes.get('/leaderboard', (req: Request, res: Response) => {
  const sport = (req.query.sport as string) || 'padel';
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const key = `elo_${sport}` as keyof typeof store.users[0];

  const players = store.users
    .filter(u => u.is_active && u.matches_played > 0)
    .map(u => ({ id: u.id, full_name: u.full_name, avatar_url: u.avatar_url, elo: u[key] as number, matches_played: u.matches_played }))
    .sort((a, b) => b.elo - a.elo)
    .slice(0, limit);

  res.json({ success: true, data: players });
});
