// server/routes/tasks.mjs
import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

/** GET /api/tasks – liste til admin */
router.get('/', async (_req, res) => {
  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      carrier:  { select: { id: true, email: true } },
      customer: { select: { id: true, email: true } },
    },
  });
  res.json(tasks);
});

/** POST /api/tasks – opret ny task (kræver mindst title) */
router.post('/', async (req, res) => {
  try {
    const { title, pickup, dropoff, price, scheduledAt, customerId } = req.body || {};
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'title kræves' });
    }

    const when = scheduledAt ? new Date(scheduledAt) : null;
    const isValidDate = (d) => d instanceof Date && !isNaN(d);

    const data = {
      title: title.trim(),
      status: 'NEW',
      pickup: pickup ?? null,
      dropoff: dropoff ?? null,
      price: typeof price === 'number' ? price : null,
      scheduledAt: isValidDate(when) ? when : null,
      customerId: Number.isInteger(customerId) ? customerId : null,
    };

    const task = await prisma.task.create({ data });
    return res.status(201).json(task);
  } catch (e) {
    console.error('Create task error:', e);
    return res.status(500).json({ error: 'Serverfejl ved oprettelse' });
  }
});

/** PATCH /api/tasks/:id/status – opdatér status (Kanban) */
router.patch('/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body || {};
    const allowed = ['NEW', 'PLANNED', 'IN_PROGRESS', 'DELIVERED', 'CANCELLED'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Ugyldig status' });

    const task = await prisma.task.update({ where: { id }, data: { status } });
    res.json(task);
  } catch (e) {
    console.error('Update status error:', e);
    res.status(500).json({ error: 'Serverfejl ved statusopdatering' });
  }
});

/** GET /api/tasks/:id/bids – se bud på en task (admin) */
router.get('/:id/bids', async (req, res) => {
  const id = Number(req.params.id);
  const bids = await prisma.bid.findMany({
    where: { taskId: id },
    orderBy: { createdAt: 'desc' },
    include: { carrier: { select: { id: true, email: true } } },
  });
  res.json(bids);
});

/** POST /api/tasks/:id/assign – acceptér bud og tildel carrier */
router.post('/:id/assign', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { bidId } = req.body || {};
    if (!bidId) return res.status(400).json({ error: 'bidId kræves' });

    const bid = await prisma.bid.findUnique({ where: { id: Number(bidId) } });
    if (!bid || bid.taskId !== id) return res.status(400).json({ error: 'Bud matcher ikke task' });

    await prisma.$transaction([
      prisma.bid.update({ where: { id: bid.id }, data: { status: 'ACCEPTED' } }),
      prisma.bid.updateMany({ where: { taskId: id, NOT: { id: bid.id } }, data: { status: 'REJECTED' } }),
      prisma.task.update({
        where: { id },
        data: { carrierId: bid.carrierId, price: bid.amount, status: 'PLANNED' },
      }),
    ]);

    const updated = await prisma.task.findUnique({
      where: { id },
      include: { carrier: { select: { id: true, email: true } } },
    });

    res.json(updated);
  } catch (e) {
    console.error('Assign bid error:', e);
    res.status(500).json({ error: 'Serverfejl ved tildeling' });
  }
});

export default router;
