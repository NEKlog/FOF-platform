// server/routes/admin-carrier.mjs
import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

/**
 * GET /api/admin/carrier/pending
 * Carriers med approved=false (inkl. dokumenter)
 */
router.get('/pending', async (_req, res) => {
  const rows = await prisma.user.findMany({
    where: { role: 'carrier', approved: false },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      createdAt: true,
      active: true,
      approved: true,
      carrierDocs: {
        select: { id: true, type: true, url: true, filename: true, verified: true, uploadedAt: true, notes: true }
      }
    }
  });
  res.json(rows);
});

/**
 * GET /api/admin/carrier/:id/docs
 */
router.get('/:id/docs', async (req, res) => {
  const id = Number(req.params.id);
  const docs = await prisma.carrierDocument.findMany({
    where: { userId: id },
    orderBy: { uploadedAt: 'desc' }
  });
  res.json(docs);
});

/**
 * POST /api/admin/carrier/:id/docs
 * Body: { type: 'INSURANCE'|'LICENSE'|'CVR'|'OTHER', url, filename?, notes? }
 * (MVP: vi gemmer URL/filnavn – rigtig filupload kan vi tage med multer/S3 senere)
 */
router.post('/:id/docs', async (req, res) => {
  const id = Number(req.params.id);
  const { type, url, filename, notes } = req.body || {};
  if (!type || !url) return res.status(400).json({ error: 'type og url kræves' });

  const valid = ['INSURANCE','LICENSE','CVR','OTHER'];
  if (!valid.includes(type)) return res.status(400).json({ error: 'Ugyldig type' });

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== 'carrier') return res.status(404).json({ error: 'Carrier ikke fundet' });

  const doc = await prisma.carrierDocument.create({
    data: { userId: id, type, url, filename: filename || null, notes: notes || null }
  });
  res.status(201).json(doc);
});

/**
 * PATCH /api/admin/carrier/docs/:docId
 * Body: { verified?: boolean, notes?: string }
 */
router.patch('/docs/:docId', async (req, res) => {
  const docId = Number(req.params.docId);
  const { verified, notes } = req.body || {};
  const doc = await prisma.carrierDocument.update({
    where: { id: docId },
    data: {
      ...(typeof verified === 'boolean' ? { verified } : {}),
      ...(typeof notes === 'string' ? { notes } : {}),
    }
  });
  res.json(doc);
});

export default router;
