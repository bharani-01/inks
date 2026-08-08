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
      console.log('  ✓ Admin user already exists');
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

    console.log('  ✓ Default admin created');
    console.log('    Email:    admin@printa.com');
    console.log('    Password: admin123');
    console.log('    ⚠ Change this password after first login!');
  } catch (err) {
    console.error('  ✗ Failed to seed admin:', err.message);
  }
}

module.exports = seedAdmin;
