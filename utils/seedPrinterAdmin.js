/**
 * Seeds a default Printer Admin user.
 * Run: node utils/seedPrinterAdmin.js
 * Credentials: printer@inks.com / printer123
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../config/db');

async function seedPrinterAdmin() {
  try {
    const email = 'printer@inks.com';

    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      if (existing.role !== 'PRINTER_ADMIN') {
        // Update role if user exists but isn't a printer admin
        await prisma.user.update({
          where: { email },
          data: { role: 'PRINTER_ADMIN', isActive: true },
        });
        console.log(`  [OK] Updated ${email} to PRINTER_ADMIN`);
      } else {
        console.log(`  [OK] Printer Admin already exists: ${email}`);
      }
      return;
    }

    const passwordHash = await bcrypt.hash('printer123', 12);

    const user = await prisma.user.create({
      data: {
        name: 'Printer Admin',
        email,
        passwordHash,
        role: 'PRINTER_ADMIN',
        isActive: true,
      },
    });

    console.log('\n  Printer Admin Seeded');
    console.log('  ─────────────────────');
    console.log(`  Name:     ${user.name}`);
    console.log(`  Email:    ${email}`);
    console.log(`  Password: printer123`);
    console.log(`  Role:     PRINTER_ADMIN`);
    console.log('  [Note] Change this password after first login\n');
  } catch (err) {
    console.error('  [Error] Failed to seed printer admin:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

seedPrinterAdmin();
