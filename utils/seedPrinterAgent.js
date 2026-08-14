const prisma = require('../config/db');
const bcrypt = require('bcryptjs');

/**
 * Seed script for creating or upgrading a Printer Agent user account.
 * Usage: node utils/seedPrinterAgent.js <email> <password> <name>
 */
async function seedPrinterAgent() {
  const email = process.argv[2] || 'agent@trackifyapp.co.in';
  const password = process.argv[3] || 'Agent@123456';
  const name = process.argv[4] || 'Store Printer Agent';

  console.log(`\n  Seeding Printer Agent user: ${email}...`);

  try {
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { role: 'PRINTER_AGENT', isActive: true },
      });
      console.log(`  [OK] Updated existing user ${email} (ID: ${updated.id}) to PRINTER_AGENT role.`);
    } else {
      const passwordHash = await bcrypt.hash(password, 12);
      const created = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: 'PRINTER_AGENT',
          isActive: true,
        },
      });
      console.log(`  [OK] Created new PRINTER_AGENT account: ${email} (ID: ${created.id})`);
    }

    console.log('\n  Agent Login Credentials:');
    console.log(`  Email:    ${email}`);
    console.log(`  Password: ${password}`);
    console.log(`  Role:     PRINTER_AGENT\n`);
  } catch (err) {
    console.error('Failed to seed printer agent:', err);
  } finally {
    await prisma.$disconnect();
  }
}

seedPrinterAgent();
