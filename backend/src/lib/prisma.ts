// backend/src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Singleton de Prisma con configuración de pool ajustada para MySQL remoto.
 * connection_limit: máximo de conexiones simultáneas al pool
 * pool_timeout: segundos de espera antes de lanzar P2024
 * connect_timeout: segundos para abrir la conexión TCP inicial
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: (() => {
          const base = process.env.DATABASE_URL ?? '';
          // Añadir parámetros de pool solo si no vienen ya en la URL
          if (base.includes('connection_limit')) return base;
          const separator = base.includes('?') ? '&' : '?';
          return `${base}${separator}connection_limit=5&pool_timeout=30&connect_timeout=20`;
        })(),
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

