// server/index.mjs
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes, {
  requireAuth,
  requireAdmin,
  requireCarrier,
  requireCustomer,
  requireActive,
  requireApproved,
} from './routes/auth.mjs';

import tasksRoutes from './routes/tasks.mjs';
import carrierRoutes from './routes/carrier.mjs';
import bidsRoutes from './routes/bids.mjs';
import adminCarrierRoutes from './routes/admin-carrier.mjs';
// import customerRoutes from './routes/customer.mjs';

const app = express();
app.use(cors());
app.use(express.json());

// health
app.get('/health', (_req, res) => res.json({ ok: true }));

// auth routes (offentlige + beskyttede undervejs)
app.use('/api/auth', authRoutes);

// admin: tasks
app.use(
  '/api/tasks',
  requireAuth,
  requireActive,
  requireApproved,
  requireAdmin,
  tasksRoutes
);

// carrier-API
app.use(
  '/api/carrier',
  requireAuth,
  requireActive,
  requireApproved,
  requireCarrier,
  carrierRoutes
);

// bud (kan være carrier, evt. også admin hvis du vil)
app.use(
  '/api/bids',
  requireAuth,
  requireActive,
  requireApproved,
  requireCarrier,
  bidsRoutes
);


app.use('/api/admin/carrier', requireAuth, requireAdmin, adminCarrierRoutes);

// costumer-API
// app.use(
//   '/api/customer',
//   requireAuth,
//   requireActive,
//   requireApproved,
//   requireCustomer,
//   customerRoutes
// );

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server kører på port ${PORT}`));

