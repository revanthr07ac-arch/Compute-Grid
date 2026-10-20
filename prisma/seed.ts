import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Seeding initial database records...');

  const adminPasswordHash = await bcrypt.hash('AdminGrid123!', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@computegrid.io' },
    update: {},
    create: {
      email: 'admin@computegrid.io',
      username: 'admin',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
  });

  const demoPasswordHash = await bcrypt.hash('DemoGrid123!', 10);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@computegrid.io' },
    update: {},
    create: {
      email: 'demo@computegrid.io',
      username: 'demouser',
      passwordHash: demoPasswordHash,
      role: 'USER',
    },
  });

  // Create an enrollment token for demouser (idempotent upsert)
  const token = await prisma.workerEnrollmentToken.upsert({
    where: { token: 'cg_enroll_demo_initial_token_12345' },
    update: {},
    create: {
      userId: demoUser.id,
      token: 'cg_enroll_demo_initial_token_12345',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      maxUses: 100,
    },
  });

  console.log('[Seed] Database seeded successfully:');
  console.log(` - Admin: admin@computegrid.io / AdminGrid123!`);
  console.log(` - User:  demo@computegrid.io / DemoGrid123!`);
  console.log(` - Worker Enrollment Token: ${token.token}`);
}

main()
  .catch(e => {
    console.error('[Seed] Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
