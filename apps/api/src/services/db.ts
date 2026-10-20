import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log('[Database] Connected successfully to database');
  } catch (error) {
    console.error('[Database] Failed to connect to database:', error);
    throw error;
  }
}
