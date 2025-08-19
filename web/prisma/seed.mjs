import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@local';
  const password = await bcrypt.hash('admin1234', 10);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password,
      role: 'ADMIN',
      approved: true,
      active: true,
    },
  });

  console.log('Seed: admin bruger klar ->', email, '/ admin1234');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
