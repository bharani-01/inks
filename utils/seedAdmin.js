const bcrypt = require('bcryptjs');
const prisma = require('../config/db');

/**
 * Seeds a default admin user on first run.
 * Credentials: admin@printa.com / admin123
 */
async function seedAdmin() {
  try {
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@printa.com' },
    });

    if (existingAdmin) {
      console.log('  [OK] Admin user already exists');
      return;
    }

    const passwordHash = await bcrypt.hash('admin123', 12);

    await prisma.user.create({
      data: {
        name: 'Admin',
        email: 'admin@printa.com',
        passwordHash,
        role: 'ADMIN',
        isActive: true,
      },
    });

    console.log('  [OK] Default admin created');
    console.log('    Email:    admin@printa.com');
    console.log('    Password: admin123');
    console.log('    [Note] Change this password after first login');
  } catch (err) {
    console.error('  [Error] Failed to seed admin:', err.message);
  }
}

module.exports = seedAdmin;
