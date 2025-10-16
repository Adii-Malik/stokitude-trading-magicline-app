import express from 'express';
import User from '../models/User.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication and admin check to all routes
router.use(authenticate, requireAdmin);

// GET /api/admin/users - Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: {
        users,
        count: users.length
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// GET /api/admin/users/pending - Get pending users (not active)
router.get('/users/pending', async (req, res) => {
  try {
    const users = await User.find({ isActive: false })
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: {
        users,
        count: users.length
      }
    });
  } catch (error) {
    console.error('Error fetching pending users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending users',
      error: error.message
    });
  }
});

// PUT /api/admin/users/:userId/activate - Activate user
router.put('/users/:userId/activate', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { isActive: true },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    console.log(`✅ User activated: ${user.username} by admin ${req.user.username}`);
    
    res.json({
      success: true,
      message: 'User activated successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Error activating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate user',
      error: error.message
    });
  }
});

// PUT /api/admin/users/:userId/deactivate - Deactivate user
router.put('/users/:userId/deactivate', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Prevent admin from deactivating themselves
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account'
      });
    }
    
    // Get user first to check their role
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Only super_admin can deactivate admins or super_admins
    if ((user.role === 'admin' || user.role === 'super_admin') && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only Super Admin can deactivate admin users'
      });
    }

    // Super admins cannot be deactivated
    if (user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Super Admin cannot be deactivated'
      });
    }

    user.isActive = false;
    await user.save();
    
    console.log(`❌ User deactivated: ${user.username} by ${req.user.role} ${req.user.username}`);
    
    res.json({
      success: true,
      message: 'User deactivated successfully',
      data: { user: user.toSafeObject() }
    });
  } catch (error) {
    console.error('Error deactivating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate user',
      error: error.message
    });
  }
});

// PUT /api/admin/users/:userId/toggle-role - Toggle user role (only super_admin can create admins)
router.put('/users/:userId/toggle-role', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Prevent admin from changing their own role
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change your own role'
      });
    }
    
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Only super_admin can promote users to admin
    if (user.role === 'user' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only Super Admin can promote users to admin role'
      });
    }

    // Prevent non-super_admin from demoting admins or super_admins
    if ((user.role === 'admin' || user.role === 'super_admin') && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only Super Admin can change admin roles'
      });
    }

    // Super admins cannot be demoted
    if (user.role === 'super_admin') {
      return res.status(400).json({
        success: false,
        message: 'Super Admin role cannot be changed'
      });
    }
    
    // Toggle role between user and admin
    user.role = user.role === 'admin' ? 'user' : 'admin';
    
    // If promoting to admin, automatically activate
    if (user.role === 'admin') {
      user.isActive = true;
    }
    
    await user.save();
    
    console.log(`🔄 User role changed: ${user.username} is now ${user.role} by ${req.user.role} ${req.user.username}`);
    
    res.json({
      success: true,
      message: `User role updated to ${user.role}`,
      data: { user: user.toSafeObject() }
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role',
      error: error.message
    });
  }
});

// DELETE /api/admin/users/:userId - Delete user
router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Prevent admin from deleting themselves
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }
    
    // Get user first to check their role
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Only super_admin can delete admins or super_admins
    if ((user.role === 'admin' || user.role === 'super_admin') && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only Super Admin can delete admin users'
      });
    }

    // Super admins cannot be deleted at all
    if (user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Super Admin cannot be deleted'
      });
    }
    
    await User.findByIdAndDelete(userId);
    
    console.log(`🗑️ User deleted: ${user.username} by ${req.user.role} ${req.user.username}`);
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
});

// GET /api/admin/stats - Get admin dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const pendingUsers = await User.countDocuments({ isActive: false });
    const adminUsers = await User.countDocuments({ role: 'admin' });
    
    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        pendingUsers,
        adminUsers
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

export default router;

