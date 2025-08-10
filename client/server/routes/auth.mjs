// server/routes/auth.mjs
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret'; // SKIFT i prod
const ROLES = ['admin', 'customer', 'carrier'];

// --- helpers ---
function parseBool(v) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).toLowerCase().trim();
  if (['true','1','yes','ja'].includes(s)) return true;
  if (['false','0','no','nej'].includes(s)) return false;
  return undefined;
}

// --- GUARDS (exporteres) ---
export function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Ingen token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET); // { id, email, role }
    next();
  } catch {
    return res.status(401).json({ error: 'Ugyldig token' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Kun admin' });
  next();
}

export async function requireActive(req, res, next) {
  try {
    const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { active: true } });
    if (!u?.active) return res.status(403).json({ error: 'ACCOUNT_DISABLED' });
    next();
  } catch (e) {
    console.error('requireActive', e);
    res.status(500).json({ error: 'Serverfejl' });
  }
}

export async function requireApproved(req, res, next) {
  try {
    const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { approved: true, role: true } });
    if (!u?.approved) {
      // kan evt. nuancere med reason som i login
      return res.status(403).json({ error: 'NOT_APPROVED' });
    }
    next();
  } catch (e) {
    console.error('requireApproved', e);
    res.status(500).json({ error: 'Serverfejl' });
  }
}

export async function requireCarrier(req, res, next) {
  try {
    if (req.user?.role !== 'carrier') return res.status(403).json({ error: 'Kun for transportører' });
    const u = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { active: true, approved: true }
    });
    if (!u) return res.status(401).json({ error: 'Bruger ikke fundet' });
    if (!u.active) return res.status(403).json({ error: 'ACCOUNT_DISABLED' });
    if (!u.approved) return res.status(403).json({ error: 'NOT_APPROVED' });
    next();
  } catch (e) {
    console.error('requireCarrier', e);
    res.status(500).json({ error: 'Serverfejl' });
  }
}

export function requireCustomer(req, res, next) {
  if (req.user?.role !== 'customer') return res.status(403).json({ error: 'Kun for kunder' });
  next();
}

// --- AUTH ROUTES ---

// Register
router.post('/register', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) return res.status(400).json({ error: 'Manglende felter' });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(400).json({ error: 'Email er allerede registreret' });

  const hashed = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      email,
      password: hashed,
      role,            // 'admin' | 'customer' | 'carrier'
      approved: false, // alle starter false (din nuværende sikkerhedsmodel)
      active: true,
    },
  });

  res.status(201).json({ message: 'Bruger oprettet' });
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Forkert login' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Forkert login' });

  if (!user.active) return res.status(403).json({ error: 'ACCOUNT_DISABLED' });

  if (!user.approved) {
    const reason = user.role === 'customer' ? 'PENDING_2FA' : 'PENDING_CARRIER_DOCS';
    return res.status(403).json({ error: 'NOT_APPROVED', reason });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
  res.json({ token, role: user.role });
});

// Me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(401).json({ error: 'Ukendt bruger' });
    if (!user.active) return res.status(403).json({ error: 'ACCOUNT_DISABLED' });
    if (user.role === 'carrier' && !user.approved) return res.status(403).json({ error: 'NOT_APPROVED' });

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      approved: user.approved,
      active: user.active,
      createdAt: user.createdAt,
    });
  } catch (e) {
    console.error('/me error', e);
    res.status(401).json({ error: 'Ugyldig token' });
  }
});

// Admin: alle brugere (med filtre)
router.get('/all-users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { role, approved, active } = req.query;
    const where = {};
    if (role && ROLES.includes(String(role).toLowerCase())) where.role = String(role).toLowerCase();
    const a = parseBool(approved);
    if (a !== undefined) where.approved = a;
    const act = parseBool(active);
    if (act !== undefined) where.active = act;

    const users = await prisma.user.findMany({
      where,
      select: { id: true, email: true, role: true, approved: true, active: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (e) {
    console.error('all-users error', e);
    res.status(500).json({ error: 'Kunne ikke hente brugere' });
  }
});

router.get('/pending-carriers', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const carriers = await prisma.user.findMany({
      where: { role: 'carrier', approved: false },
      select: { id: true, email: true, createdAt: true, active: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(carriers);
  } catch (e) {
    console.error('pending-carriers error', e);
    res.status(500).json({ error: 'Kunne ikke hente carriers' });
  }
});

router.post('/approve/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.user.update({ where: { id: parseInt(id, 10) }, data: { approved: true } });
    res.json({ message: 'Bruger godkendt' });
  } catch (e) {
    console.error('approve error', e);
    res.status(500).json({ error: 'Kunne ikke godkende bruger' });
  }
});

router.post('/block/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.user.update({ where: { id: parseInt(id, 10) }, data: { approved: false } });
    res.json({ message: 'Bruger blokeret' });
  } catch (e) {
    console.error('block error', e);
    res.status(500).json({ error: 'Kunne ikke blokere bruger' });
  }
});

router.post('/toggle-active/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id: parseInt(id, 10) } });
    if (!user) return res.status(404).json({ error: 'Bruger ikke fundet' });
    const updated = await prisma.user.update({ where: { id: user.id }, data: { active: !user.active } });
    res.json({ message: updated.active ? 'Bruger genaktiveret' : 'Bruger deaktiveret', active: updated.active });
  } catch (e) {
    console.error('toggle-active error', e);
    res.status(500).json({ error: 'Kunne ikke skifte aktiv status' });
  }
});

router.get('/roles', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const rows = await prisma.user.findMany({ select: { role: true }, distinct: ['role'] });
    const dbRoles = rows.map(r => String(r.role || '').toLowerCase()).filter(Boolean);
    const unique = Array.from(new Set([...ROLES, ...dbRoles])).sort();
    res.json(unique);
  } catch (e) {
    console.error('roles error', e);
    res.status(500).json({ error: 'Kunne ikke hente roller' });
  }
});

router.post('/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const nextRole = String(req.body?.role || '').toLowerCase();
    if (!ROLES.includes(nextRole)) return res.status(400).json({ error: 'Ugyldig rolle' });
    if (parseInt(id, 10) === req.user.id && nextRole !== 'admin') {
      return res.status(400).json({ error: 'Du kan ikke fjerne din egen admin-rolle' });
    }
    await prisma.user.update({ where: { id: parseInt(id, 10) }, data: { role: nextRole } });
    res.json({ message: 'Rolle opdateret', role: nextRole });
  } catch (e) {
    console.error('set-role error', e);
    res.status(500).json({ error: 'Kunne ikke opdatere rolle' });
  }
});

export default router;
