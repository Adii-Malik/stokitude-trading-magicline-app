import 'dotenv/config';
import { connectDB } from '../config/mongodb.js';
import User from '../models/User.js';
import config from '../config/config.js';

const createSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    await connectDB(config.mongoUri);
    console.log('📦 Connected to MongoDB');

    // Super admin details
    const superAdminEmail = 'assassinboys22@gmail.com';
    const temporaryPassword = 'Admin@123'; // Change this after first login

    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({ email: superAdminEmail });

    if (existingSuperAdmin) {
      console.log('✅ Super Admin already exists - resetting password');
      console.log(`   Email: ${existingSuperAdmin.email}`);
      console.log(`   Username: ${existingSuperAdmin.username}`);
      console.log(`   Role: ${existingSuperAdmin.role}`);

      // Reset password and ensure active
      existingSuperAdmin.password = temporaryPassword;
      existingSuperAdmin.isActive = true;
      await existingSuperAdmin.save();

      console.log('🎉 Super Admin password reset successfully!');
    } else {
      // Create super admin
      const superAdmin = new User({
        username: 'superadmin',
        email: superAdminEmail,
        password: temporaryPassword,
        role: 'super_admin',
        isActive: true // Super admin is always active
      });

      await superAdmin.save();

      console.log('🎉 Super Admin created successfully!');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email:    ${superAdminEmail}`);
    console.log(`   Username: superadmin`);
    console.log(`   Password: ${temporaryPassword}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  IMPORTANT: Change your password after first login!');
    console.log('   Go to Settings → Change Password');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating super admin:', error);
    process.exit(1);
  }
};

createSuperAdmin();

