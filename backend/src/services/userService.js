const db = require('../config/database');
const bcrypt = require('bcrypt');
const { parsePaginationParams, formatPaginatedResponse } = require('../utils/pagination');

class UserService {
  /**
   * Get all users (admin only)
   */
  async getUsers(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['u.tenant_id = ?'];
    const params = [tenantId];

    if (filters.role) {
      whereConditions.push('u.role = ?');
      params.push(filters.role);
    }

    if (filters.status) {
      whereConditions.push('u.is_active = ?');
      params.push(filters.status === 'active' ? 1 : 0);
    }

    if (filters.search) {
      whereConditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM users u ${whereClause}`, params);
    const total = countResult?.total || 0;

    const users = await db.allAsync(`
      SELECT 
        u.id, u.tenant_id, u.email, u.first_name, u.last_name, u.role, u.is_active,
        u.created_at, u.updated_at,
        p.avatar_url, p.phone, p.bio
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return formatPaginatedResponse(users, total, page, limit);
  }

  /**
   * Get user by ID
   */
  async getUserById(tenantId, userId) {
    const user = await db.getAsync(`
      SELECT 
        u.id, u.tenant_id, u.email, u.first_name, u.last_name, u.role, u.is_active,
        u.created_at, u.updated_at,
        p.*
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.id = ? AND u.tenant_id = ?
    `, [userId, tenantId]);

    if (!user) {
      throw new Error('User not found');
    }

    return {
      ...user,
      social_links: user.social_links ? (this._tryParseJSON(user.social_links) || {}) : {},
      preferences: user.preferences ? (this._tryParseJSON(user.preferences) || {}) : {},
      notification_settings: user.notification_settings ? (this._tryParseJSON(user.notification_settings) || {}) : {}
    };
  }

  /**
   * Get user profile
   */
  async getUserProfile(tenantId, userId) {
    const profile = await db.getAsync(`
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.role, u.is_active,
        p.*
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.id = ? AND u.tenant_id = ?
    `, [userId, tenantId]);

    if (!profile) {
      throw new Error('User not found');
    }

    // Parse JSON fields and extract nested data for easier frontend access
    const socialLinks = profile.social_links ? (this._tryParseJSON(profile.social_links) || {}) : {};
    const preferences = profile.preferences ? (this._tryParseJSON(profile.preferences) || {}) : {};
    
    return {
      ...profile,
      // Extract social links to top level
      facebook: socialLinks.facebook || '',
      twitter: socialLinks.twitter || '',
      linkedin: socialLinks.linkedin || '',
      youtube: socialLinks.youtube || '',
      // Extract preferences to top level
      profession: preferences.profession || '',
      companyName: preferences.companyName || '',
      companyWebsite: preferences.companyWebsite || '',
      skills: preferences.skills || '',
      profileVisibility: preferences.profileVisibility || 'option3',
      // Keep original nested objects too
      social_links: socialLinks,
      preferences: preferences,
      notification_settings: profile.notification_settings ? (this._tryParseJSON(profile.notification_settings) || {}) : {}
    };
  }

  /**
   * Update user profile
   */
  async updateUserProfile(tenantId, userId, profileData) {
    // Check if profile exists
    const existing = await db.getAsync(`
      SELECT * FROM user_profiles WHERE user_id = ? AND tenant_id = ?
    `, [userId, tenantId]);

    const fields = {
      avatarUrl: 'avatar_url',
      bio: 'bio',
      phone: 'phone',
      address: 'address',
      city: 'city',
      state: 'state',
      country: 'country',
      postalCode: 'postal_code',
      dateOfBirth: 'date_of_birth',
      gender: 'gender',
      website: 'website',
      timezone: 'timezone',
      language: 'language'
    };

    if (existing) {
      // Update existing profile
      const updates = [];
      const params = [];

      Object.keys(fields).forEach(key => {
        if (profileData[key] !== undefined) {
          updates.push(`${fields[key]} = ?`);
          params.push(profileData[key] || null);
        }
      });

      if (profileData.socialLinks !== undefined) {
        updates.push('social_links = ?');
        params.push(profileData.socialLinks ? (typeof profileData.socialLinks === 'object' ? JSON.stringify(profileData.socialLinks) : profileData.socialLinks) : null);
      }

      if (profileData.preferences !== undefined) {
        updates.push('preferences = ?');
        params.push(profileData.preferences ? (typeof profileData.preferences === 'object' ? JSON.stringify(profileData.preferences) : profileData.preferences) : null);
      }

      if (profileData.notificationSettings !== undefined) {
        updates.push('notification_settings = ?');
        params.push(profileData.notificationSettings ? (typeof profileData.notificationSettings === 'object' ? JSON.stringify(profileData.notificationSettings) : profileData.notificationSettings) : null);
      }

      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(userId, tenantId);

        await db.runAsync(`
          UPDATE user_profiles
          SET ${updates.join(', ')}
          WHERE user_id = ? AND tenant_id = ?
        `, params);
      }
    } else {
      // Create new profile
      const insertFields = ['tenant_id', 'user_id'];
      const insertValues = [tenantId, userId];
      const placeholders = ['?', '?'];

      Object.keys(fields).forEach(key => {
        if (profileData[key] !== undefined) {
          insertFields.push(fields[key]);
          insertValues.push(profileData[key] || null);
          placeholders.push('?');
        }
      });

      if (profileData.socialLinks !== undefined) {
        insertFields.push('social_links');
        insertValues.push(profileData.socialLinks ? (typeof profileData.socialLinks === 'object' ? JSON.stringify(profileData.socialLinks) : profileData.socialLinks) : null);
        placeholders.push('?');
      }

      if (profileData.preferences !== undefined) {
        insertFields.push('preferences');
        insertValues.push(profileData.preferences ? (typeof profileData.preferences === 'object' ? JSON.stringify(profileData.preferences) : profileData.preferences) : null);
        placeholders.push('?');
      }

      if (profileData.notificationSettings !== undefined) {
        insertFields.push('notification_settings');
        insertValues.push(profileData.notificationSettings ? (typeof profileData.notificationSettings === 'object' ? JSON.stringify(profileData.notificationSettings) : profileData.notificationSettings) : null);
        placeholders.push('?');
      }

      await db.runAsync(`
        INSERT INTO user_profiles (${insertFields.join(', ')})
        VALUES (${placeholders.join(', ')})
      `, insertValues);
    }

    // Also update user basic info if provided
    if (profileData.firstName || profileData.lastName || profileData.email) {
      const userUpdates = [];
      const userParams = [];

      if (profileData.firstName) {
        userUpdates.push('first_name = ?');
        userParams.push(profileData.firstName);
      }

      if (profileData.lastName) {
        userUpdates.push('last_name = ?');
        userParams.push(profileData.lastName);
      }

      if (profileData.email) {
        // Check if email is already taken by another user
        const emailCheck = await db.getAsync(`
          SELECT id FROM users WHERE email = ? AND id != ? AND tenant_id = ?
        `, [profileData.email, userId, tenantId]);
        
        if (emailCheck) {
          throw new Error('Email is already taken by another user');
        }
        
        userUpdates.push('email = ?');
        userParams.push(profileData.email);
      }

      // Handle password update if provided
      if (profileData.password) {
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(profileData.password, saltRounds);
        userUpdates.push('password_hash = ?');
        userParams.push(passwordHash);
      }

      if (userUpdates.length > 0) {
        userUpdates.push('updated_at = CURRENT_TIMESTAMP');
        userParams.push(userId, tenantId);

        await db.runAsync(`
          UPDATE users
          SET ${userUpdates.join(', ')}
          WHERE id = ? AND tenant_id = ?
        `, userParams);
      }
    }

    // Handle social links (Facebook, Twitter, LinkedIn, YouTube)
    if (profileData.facebook || profileData.twitter || profileData.linkedin || profileData.youtube) {
      const socialLinks = existing?.social_links ? this._tryParseJSON(existing.social_links) || {} : {};
      
      if (profileData.facebook !== undefined) socialLinks.facebook = profileData.facebook;
      if (profileData.twitter !== undefined) socialLinks.twitter = profileData.twitter;
      if (profileData.linkedin !== undefined) socialLinks.linkedin = profileData.linkedin;
      if (profileData.youtube !== undefined) socialLinks.youtube = profileData.youtube;

      const updates = [];
      const params = [];
      
      updates.push('social_links = ?');
      params.push(JSON.stringify(socialLinks));
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(userId, tenantId);

      await db.runAsync(`
        UPDATE user_profiles
        SET ${updates.join(', ')}
        WHERE user_id = ? AND tenant_id = ?
      `, params);
    }

    // Handle additional profile fields (profession, company, skills, etc.)
    if (profileData.profession || profileData.companyName || profileData.companyWebsite || 
        profileData.skills || profileData.profileVisibility) {
      const preferences = existing?.preferences ? this._tryParseJSON(existing.preferences) || {} : {};
      
      if (profileData.profession !== undefined) preferences.profession = profileData.profession;
      if (profileData.companyName !== undefined) preferences.companyName = profileData.companyName;
      if (profileData.companyWebsite !== undefined) preferences.companyWebsite = profileData.companyWebsite;
      if (profileData.skills !== undefined) preferences.skills = profileData.skills;
      if (profileData.profileVisibility !== undefined) preferences.profileVisibility = profileData.profileVisibility;

      const updates = [];
      const params = [];
      
      updates.push('preferences = ?');
      params.push(JSON.stringify(preferences));
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(userId, tenantId);

      await db.runAsync(`
        UPDATE user_profiles
        SET ${updates.join(', ')}
        WHERE user_id = ? AND tenant_id = ?
      `, params);
    }

    return this.getUserProfile(tenantId, userId);
  }

  /**
   * Update user (admin only)
   */
  async updateUser(tenantId, userId, updateData) {
    const existing = await this.getUserById(tenantId, userId);

    const updates = [];
    const params = [];

    const fields = {
      firstName: 'first_name',
      lastName: 'last_name',
      email: 'email',
      role: 'role',
      isActive: 'is_active'
    };

    Object.keys(fields).forEach(key => {
      if (updateData[key] !== undefined) {
        updates.push(`${fields[key]} = ?`);
        params.push(updateData[key] || null);
      }
    });

    if (updateData.password) {
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(updateData.password, saltRounds);
      updates.push('password_hash = ?');
      params.push(passwordHash);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId, tenantId);

    await db.runAsync(`
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return this.getUserById(tenantId, userId);
  }

  /**
   * Change password
   */
  async changePassword(tenantId, userId, currentPassword, newPassword) {
    const user = await db.getAsync('SELECT password_hash FROM users WHERE id = ? AND tenant_id = ?', [userId, tenantId]);

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    await db.runAsync(`
      UPDATE users
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `, [passwordHash, userId, tenantId]);

    return { success: true };
  }

  /**
   * Log user activity
   */
  async logActivity(tenantId, userId, activityData) {
    const {
      activityType, description, ipAddress, userAgent, metadata
    } = activityData;

    if (!activityType) {
      throw new Error('Activity type is required');
    }

    await db.runAsync(`
      INSERT INTO user_activity_logs (
        tenant_id, user_id, activity_type, description, ip_address, user_agent, metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, userId, activityType, description || null,
      ipAddress || null, userAgent || null,
      metadata ? (typeof metadata === 'object' ? JSON.stringify(metadata) : metadata) : null
    ]);

    return { success: true };
  }

  /**
   * Get user activity logs
   */
  async getActivityLogs(tenantId, userId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['l.tenant_id = ?', 'l.user_id = ?'];
    const params = [tenantId, userId];

    if (filters.activityType) {
      whereConditions.push('l.activity_type = ?');
      params.push(filters.activityType);
    }

    if (filters.startDate) {
      whereConditions.push('l.created_at >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereConditions.push('l.created_at <= ?');
      params.push(filters.endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM user_activity_logs l ${whereClause}`, params);
    const total = countResult?.total || 0;

    const logs = await db.allAsync(`
      SELECT * FROM user_activity_logs l
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return formatPaginatedResponse(logs.map(log => ({
      ...log,
      metadata: log.metadata ? (this._tryParseJSON(log.metadata) || {}) : {}
    })), total, page, limit);
  }

  /**
   * Helper method to safely parse JSON
   */
  _tryParseJSON(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return str;
    }
  }
}

module.exports = new UserService();
