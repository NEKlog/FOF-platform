// server/routes/customer.mjs
import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

/**
 * GET /api/customer/tasks
 * Kundens egne opgaver
 */
router.get('/tasks', async (req, res) => {
  const customerId = req.user?.id;
  const tasks = await prisma.task.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(tasks);
});

/**
 * POST /api/customer/tasks
 * Opret task som kunde
 * Body: { title, pickup?, dropoff?, price?, scheduledAt? }
 */
router.post('/tasks', async (req, res) => {
  try {
    const customerId = req.user?.id;
    const { title, pickup, dropoff, price, scheduledAt } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ error: 'title kræves' });

    const when = scheduledAt ? new Date(scheduledAt) : null;
    const isValidDate = (d) => d instanceof Date && !isNaN(d);

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        status: 'NEW',
        pickup: pickup ?? null,
        dropoff: dropoff ?? null,
        price: typeof price === 'number' ? price : null,
        scheduledAt: isValidDate(when) ? when : null,
        customerId,
      },
    });

    res.status(201).json(task);
  } catch (e) {
    console.error('Customer create task error:', e);
    res.status(500).json({ error: 'Serverfejl ved oprettelse' });
  }
});

export default router;

