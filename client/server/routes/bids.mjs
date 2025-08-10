// server/routes/bids.mjs
import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

/**
 * POST /api/bids/task/:taskId
 * Body: { amount:number, message?:string }
 * (Beskyttet i index.mjs: requireAuth + requireActive + requireApproved + requireCarrier)
 */
router.post('/task/:taskId', async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const { amount, message } = req.body || {};
    const carrierId = req.user?.id;

    if (!carrierId) return res.status(401).json({ error: 'Ingen bruger' });
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ error: 'Ugyldigt beløb' });
    }

    // Task skal være NEW og ikke tildelt
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: 'Task ikke fundet' });
    if (task.status !== 'NEW' || task.carrierId) {
      return res.status(400).json({ error: 'Task er ikke åben for bud' });
    }

    // Ét bud per carrier per task
    const existing = await prisma.bid.findFirst({ where: { taskId, carrierId } });
    if (existing) return res.status(400).json({ error: 'Du har allerede budt på denne opgave' });

    const bid = await prisma.bid.create({
      data: {
        taskId,
        carrierId,
        amount: numericAmount,
        message: message?.trim() || null,
        status: 'PENDING',
      },
    });

    res.status(201).json(bid);
  } catch (e) {
    console.error('Create bid error:', e);
    res.status(500).json({ error: 'Serverfejl ved bud' });
  }
});

export default router;
