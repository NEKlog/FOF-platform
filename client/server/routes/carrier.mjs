// server/routes/carrier.mjs
import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

/**
 * GET /api/carrier/tasks/open
 * Opgaver der kan bydes på (NEW og uden carrier)
 * (Beskyttet i index.mjs: requireAuth + requireActive + requireApproved + requireCarrier)
 */
router.get('/tasks/open', async (_req, res) => {
  const tasks = await prisma.task.findMany({
    where: { status: 'NEW', carrierId: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, title: true, pickup: true, dropoff: true, scheduledAt: true, price: true, createdAt: true
    }
  });
  res.json(tasks);
});

/**
 * GET /api/carrier/bids/mine
 * Dine bud med tilhørende task
 */
router.get('/bids/mine', async (req, res) => {
  const carrierId = req.user?.id;
  const bids = await prisma.bid.findMany({
    where: { carrierId },
    orderBy: { createdAt: 'desc' },
    include: { task: { select: { id: true, title: true, status: true } } }
  });
  res.json(bids);
});

/**
 * (valgfri) GET /api/carrier/tasks/assigned
 * Dine tildelte tasks
 */
router.get('/tasks/assigned', async (req, res) => {
  const carrierId = req.user?.id;
  const tasks = await prisma.task.findMany({
    where: { carrierId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, status: true, price: true, scheduledAt: true, createdAt: true }
  });
  res.json(tasks);
});

export default router;
