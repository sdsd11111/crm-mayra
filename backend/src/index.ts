// backend/src/index.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import authRoutes from './routes/auth';
import clientRoutes from './routes/clients';
import documentRoutes from './routes/documents';
import ledgerRoutes from './routes/ledger';
import whatsappRoutes from './routes/whatsapp';
import superciasRoutes from './routes/supercias';
import taskRoutes from './routes/tasks';
import { BillingCron } from './services/BillingCron';

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// Socket.io para tiempo real (WhatsApp y notificaciones)
export const io = new SocketIOServer(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`🔌 Cliente conectado por WebSocket: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`🔌 Cliente desconectado: ${socket.id}`);
  });
});

// Middlewares
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json());

// Servir archivos locales si aplica fallback
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Rutas
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'CRM Mayra Castillo - Backend',
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/supercias', superciasRoutes);
app.use('/api/tasks', taskRoutes);

// Iniciar Cronjob de facturación mensual
BillingCron.init();

server.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en http://localhost:${PORT}`);
  console.log(`📡 WebSocket listo en el puerto ${PORT}`);
});

