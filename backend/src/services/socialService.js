const db = require('../config/database');
const { parsePaginationParams, formatPaginatedResponse } = require('../utils/pagination');

class SocialService {
  /**
   * Get all posts (feed)
   */
  async getPosts(tenantId, userId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['p.tenant_id = ?'];
    const params = [tenantId];

    if (filters.userId) {
      whereConditions.push('p.user_id = ?');
      params.push(filters.userId);
    }

    if (filters.following === 'true') {
      // Get posts from users that the current user follows
      whereConditions.push(`p.user_id IN (SELECT following_id FROM social_follows WHERE follower_id = ? AND tenant_id = ?)`);
      params.push(userId, tenantId);
    }

    if (filters.postType) {
      whereConditions.push('p.post_type = ?');
      params.push(filters.postType);
    }

    if (filters.search) {
      whereConditions.push('(p.content LIKE ? OR p.link_title LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    // Only show published posts unless user is viewing their own posts
    if (!filters.userId || filters.userId !== userId) {
      whereConditions.push('p.is_published = 1');
      whereConditions.push('(p.published_at IS NULL OR p.published_at <= CURRENT_TIMESTAMP)');
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM social_posts p ${whereClause}`, params);
    const total = countResult?.total || 0;

    const posts = await db.allAsync(`
      SELECT 
        p.*,
        u.first_name || ' ' || u.last_name as author_name,
        u.email as author_email,
        (SELECT COUNT(*) FROM social_post_likes WHERE post_id = p.id AND user_id = ?) > 0 as is_liked,
        (SELECT COUNT(*) FROM social_follows WHERE follower_id = ? AND following_id = p.user_id AND tenant_id = ?) > 0 as is_following
      FROM social_posts p
      JOIN users u ON p.user_id = u.id
      ${whereClause}
      ORDER BY p.published_at DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, userId, userId, tenantId, limit, offset]);

    const parsedPosts = posts.map(post => ({
      ...post,
      is_published: Boolean(post.is_published),
      is_liked: Boolean(post.is_liked),
      is_following: Boolean(post.is_following),
      media_urls: post.media_urls ? (this._tryParseJSON(post.media_urls) || []) : [],
      poll_options: post.poll_options ? (this._tryParseJSON(post.poll_options) || []) : [],
      tags: post.tags ? (this._tryParseJSON(post.tags) || []) : []
    }));

    return formatPaginatedResponse(parsedPosts, total, page, limit);
  }

  /**
   * Get post by ID
   */
  async getPostById(tenantId, postId, userId) {
    const post = await db.getAsync(`
      SELECT 
        p.*,
        u.first_name || ' ' || u.last_name as author_name,
        u.email as author_email,
        (SELECT COUNT(*) FROM social_post_likes WHERE post_id = p.id AND user_id = ?) > 0 as is_liked,
        (SELECT COUNT(*) FROM social_follows WHERE follower_id = ? AND following_id = p.user_id AND tenant_id = ?) > 0 as is_following
      FROM social_posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ? AND p.tenant_id = ?
    `, [userId, userId, tenantId, postId, tenantId]);

    if (!post) {
      throw new Error('Post not found');
    }

    // Get comments
    post.comments = await db.allAsync(`
      SELECT 
        c.*,
        u.first_name || ' ' || u.last_name as author_name,
        u.email as author_email
      FROM social_post_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ? AND c.tenant_id = ?
      ORDER BY c.created_at ASC
    `, [postId, tenantId]);

    return {
      ...post,
      is_published: Boolean(post.is_published),
      is_liked: Boolean(post.is_liked),
      is_following: Boolean(post.is_following),
      media_urls: post.media_urls ? (this._tryParseJSON(post.media_urls) || []) : [],
      poll_options: post.poll_options ? (this._tryParseJSON(post.poll_options) || []) : [],
      tags: post.tags ? (this._tryParseJSON(post.tags) || []) : []
    };
  }

  /**
   * Create post
   */
  async createPost(tenantId, userId, postData) {
    const {
      content, postType = 'text', mediaUrls, linkUrl, linkTitle,
      linkDescription, linkImage, pollQuestion, pollOptions, pollEndDate,
      scheduledAt, tags
    } = postData;

    if (!content) {
      throw new Error('Post content is required');
    }

    const isPublished = !scheduledAt || new Date(scheduledAt) <= new Date();
    const publishedAt = isPublished ? new Date().toISOString() : null;

    const result = await db.runAsync(`
      INSERT INTO social_posts (
        tenant_id, user_id, content, post_type, media_urls, link_url,
        link_title, link_description, link_image, poll_question, poll_options,
        poll_end_date, is_published, scheduled_at, published_at, tags
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, userId, content, postType,
      mediaUrls ? (Array.isArray(mediaUrls) ? JSON.stringify(mediaUrls) : mediaUrls) : null,
      linkUrl || null, linkTitle || null, linkDescription || null, linkImage || null,
      pollQuestion || null,
      pollOptions ? (Array.isArray(pollOptions) ? JSON.stringify(pollOptions) : pollOptions) : null,
      pollEndDate || null, isPublished ? 1 : 0, scheduledAt || null, publishedAt,
      tags ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : null
    ]);

    return this.getPostById(tenantId, result.lastID, userId);
  }

  /**
   * Update post
   */
  async updatePost(tenantId, postId, userId, updateData) {
    const existing = await this.getPostById(tenantId, postId, userId);

    // Only allow author to update
    if (existing.user_id !== userId) {
      throw new Error('Not authorized to update this post');
    }

    const updates = [];
    const params = [];

    const fields = {
      content: 'content',
      linkUrl: 'link_url',
      linkTitle: 'link_title',
      linkDescription: 'link_description',
      linkImage: 'link_image',
      pollQuestion: 'poll_question',
      pollEndDate: 'poll_end_date',
      scheduledAt: 'scheduled_at'
    };

    Object.keys(fields).forEach(key => {
      if (updateData[key] !== undefined) {
        updates.push(`${fields[key]} = ?`);
        params.push(updateData[key] || null);
      }
    });

    if (updateData.mediaUrls !== undefined) {
      updates.push('media_urls = ?');
      params.push(updateData.mediaUrls ? (Array.isArray(updateData.mediaUrls) ? JSON.stringify(updateData.mediaUrls) : updateData.mediaUrls) : null);
    }

    if (updateData.pollOptions !== undefined) {
      updates.push('poll_options = ?');
      params.push(updateData.pollOptions ? (Array.isArray(updateData.pollOptions) ? JSON.stringify(updateData.pollOptions) : updateData.pollOptions) : null);
    }

    if (updateData.tags !== undefined) {
      updates.push('tags = ?');
      params.push(updateData.tags ? (Array.isArray(updateData.tags) ? JSON.stringify(updateData.tags) : updateData.tags) : null);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(postId, tenantId);

    await db.runAsync(`
      UPDATE social_posts
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return this.getPostById(tenantId, postId, userId);
  }

  /**
   * Delete post
   */
  async deletePost(tenantId, postId, userId) {
    const existing = await this.getPostById(tenantId, postId, userId);

    // Only allow author to delete
    if (existing.user_id !== userId) {
      throw new Error('Not authorized to delete this post');
    }

    await db.runAsync('DELETE FROM social_posts WHERE id = ? AND tenant_id = ?', [postId, tenantId]);
    return { success: true, deleted: existing };
  }

  /**
   * Like/Unlike post
   */
  async toggleLike(tenantId, postId, userId) {
    const existing = await db.getAsync(`
      SELECT * FROM social_post_likes
      WHERE post_id = ? AND user_id = ? AND tenant_id = ?
    `, [postId, userId, tenantId]);

    if (existing) {
      // Unlike
      await db.runAsync(`
        DELETE FROM social_post_likes
        WHERE id = ? AND tenant_id = ?
      `, [existing.id, tenantId]);

      // Update post likes count
      await db.runAsync(`
        UPDATE social_posts
        SET likes_count = likes_count - 1
        WHERE id = ? AND tenant_id = ?
      `, [postId, tenantId]);

      // Create notification for post author
      const post = await db.getAsync('SELECT user_id FROM social_posts WHERE id = ?', [postId]);
      if (post && post.user_id !== userId) {
        await db.runAsync(`
          INSERT INTO social_notifications (tenant_id, user_id, notification_type, related_user_id, related_post_id, message)
          VALUES (?, ?, 'like', ?, ?, ?)
        `, [tenantId, post.user_id, userId, postId, 'liked your post']);
      }

      return { liked: false };
    } else {
      // Like
      await db.runAsync(`
        INSERT INTO social_post_likes (tenant_id, post_id, user_id)
        VALUES (?, ?, ?)
      `, [tenantId, postId, userId]);

      // Update post likes count
      await db.runAsync(`
        UPDATE social_posts
        SET likes_count = likes_count + 1
        WHERE id = ? AND tenant_id = ?
      `, [postId, tenantId]);

      return { liked: true };
    }
  }

  /**
   * Add comment to post
   */
  async addComment(tenantId, postId, userId, commentData) {
    const { content, parentCommentId } = commentData;

    if (!content) {
      throw new Error('Comment content is required');
    }

    const result = await db.runAsync(`
      INSERT INTO social_post_comments (tenant_id, post_id, user_id, parent_comment_id, content)
      VALUES (?, ?, ?, ?, ?)
    `, [tenantId, postId, userId, parentCommentId || null, content]);

    // Update post comments count
    await db.runAsync(`
      UPDATE social_posts
      SET comments_count = comments_count + 1
      WHERE id = ? AND tenant_id = ?
    `, [postId, tenantId]);

    // Create notification for post author
    const post = await db.getAsync('SELECT user_id FROM social_posts WHERE id = ?', [postId]);
    if (post && post.user_id !== userId) {
      await db.runAsync(`
        INSERT INTO social_notifications (tenant_id, user_id, notification_type, related_user_id, related_post_id, related_comment_id, message)
        VALUES (?, ?, 'comment', ?, ?, ?, ?)
      `, [tenantId, post.user_id, userId, postId, result.lastID, 'commented on your post']);
    }

    return await db.getAsync(`
      SELECT 
        c.*,
        u.first_name || ' ' || u.last_name as author_name,
        u.email as author_email
      FROM social_post_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [result.lastID]);
  }

  /**
   * Follow/Unfollow user
   */
  async toggleFollow(tenantId, followerId, followingId) {
    if (followerId === followingId) {
      throw new Error('Cannot follow yourself');
    }

    const existing = await db.getAsync(`
      SELECT * FROM social_follows
      WHERE follower_id = ? AND following_id = ? AND tenant_id = ?
    `, [followerId, followingId, tenantId]);

    if (existing) {
      // Unfollow
      await db.runAsync(`
        DELETE FROM social_follows
        WHERE id = ? AND tenant_id = ?
      `, [existing.id, tenantId]);

      return { following: false };
    } else {
      // Follow
      await db.runAsync(`
        INSERT INTO social_follows (tenant_id, follower_id, following_id)
        VALUES (?, ?, ?)
      `, [tenantId, followerId, followingId]);

      // Create notification
      await db.runAsync(`
        INSERT INTO social_notifications (tenant_id, user_id, notification_type, related_user_id, message)
        VALUES (?, ?, 'follow', ?, ?)
      `, [tenantId, followingId, followerId, 'started following you']);

      return { following: true };
    }
  }

  /**
   * Get notifications
   */
  async getNotifications(tenantId, userId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['n.tenant_id = ?', 'n.user_id = ?'];
    const params = [tenantId, userId];

    if (filters.isRead !== undefined) {
      whereConditions.push('n.is_read = ?');
      params.push(filters.isRead ? 1 : 0);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM social_notifications n ${whereClause}`, params);
    const total = countResult?.total || 0;

    const notifications = await db.allAsync(`
      SELECT 
        n.*,
        u.first_name || ' ' || u.last_name as related_user_name
      FROM social_notifications n
      LEFT JOIN users u ON n.related_user_id = u.id
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return formatPaginatedResponse(notifications.map(n => ({
      ...n,
      is_read: Boolean(n.is_read)
    })), total, page, limit);
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(tenantId, notificationId, userId) {
    await db.runAsync(`
      UPDATE social_notifications
      SET is_read = 1
      WHERE id = ? AND user_id = ? AND tenant_id = ?
    `, [notificationId, userId, tenantId]);

    return { success: true };
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

module.exports = new SocialService();
