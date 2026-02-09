const db = require('../config/database');
const { parsePaginationParams, formatPaginatedResponse } = require('../utils/pagination');

class ChatService {
  /**
   * Get all conversations for a user
   */
  async getConversations(tenantId, userId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    // Get conversations where user is a participant
    const conversationsQuery = `
      SELECT DISTINCT
        c.id,
        c.tenant_id,
        c.conversation_type,
        c.name,
        c.created_by,
        c.created_at,
        c.updated_at,
        (
          SELECT COUNT(*) 
          FROM chat_messages m 
          WHERE m.conversation_id = c.id 
            AND m.user_id != ? 
            AND m.is_read = 0
        ) as unread_count,
        (
          SELECT m.message 
          FROM chat_messages m 
          WHERE m.conversation_id = c.id 
          ORDER BY m.created_at DESC 
          LIMIT 1
        ) as last_message,
        (
          SELECT m.created_at 
          FROM chat_messages m 
          WHERE m.conversation_id = c.id 
          ORDER BY m.created_at DESC 
          LIMIT 1
        ) as last_message_at
      FROM chat_conversations c
      INNER JOIN chat_participants p ON c.id = p.conversation_id
      WHERE c.tenant_id = ? AND p.user_id = ?
      ORDER BY last_message_at DESC, c.updated_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const conversations = await db.allAsync(conversationsQuery, [userId, tenantId, userId, limit, offset]);

    // Get total count
    const countResult = await db.getAsync(`
      SELECT COUNT(DISTINCT c.id) as total
      FROM chat_conversations c
      INNER JOIN chat_participants p ON c.id = p.conversation_id
      WHERE c.tenant_id = ? AND p.user_id = ?
    `, [tenantId, userId]);
    const total = countResult?.total || 0;

    // OPTIMIZATION: Get ALL participants in ONE query instead of N+1 loop
    const conversationIds = conversations.map(c => c.id);
    if (conversationIds.length > 0) {
      const placeholders = conversationIds.map(() => '?').join(',');
      const participantsQuery = `
        SELECT 
          cp.conversation_id,
          cp.user_id,
          u.first_name,
          u.last_name,
          u.email,
          u.avatar
        FROM chat_participants cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.conversation_id IN (${placeholders})
      `;
      
      const allParticipants = await db.allAsync(participantsQuery, conversationIds);
      
      // Group participants by conversation_id
      const participantsMap = {};
      allParticipants.forEach(p => {
        if (!participantsMap[p.conversation_id]) {
          participantsMap[p.conversation_id] = [];
        }
        participantsMap[p.conversation_id].push({
          userId: p.user_id,
          firstName: p.first_name,
          lastName: p.last_name,
          email: p.email,
          avatar: p.avatar
        });
      });
      
      // Attach participants to conversations
      conversations.forEach(conv => {
        conv.participants = participantsMap[conv.id] || [];
      });
    } else {
      conversations.forEach(conv => {
        conv.participants = [];
      });
    }

    return formatPaginatedResponse(conversations, total, page, limit);
  }

  /**
   * Get or create direct conversation between two users
   */
  async getOrCreateDirectConversation(tenantId, userId1, userId2) {
    // Check if conversation already exists
    const existing = await db.getAsync(`
      SELECT c.*
      FROM chat_conversations c
      INNER JOIN chat_participants p1 ON c.id = p1.conversation_id AND p1.user_id = ?
      INNER JOIN chat_participants p2 ON c.id = p2.conversation_id AND p2.user_id = ?
      WHERE c.tenant_id = ? AND c.conversation_type = 'direct'
    `, [userId1, userId2, tenantId]);

    if (existing) {
      return existing;
    }

    // Create new direct conversation
    const result = await db.runAsync(`
      INSERT INTO chat_conversations (tenant_id, conversation_type, created_by)
      VALUES (?, 'direct', ?)
    `, [tenantId, userId1]);

    const conversationId = result.lastID;

    // Add both users as participants
    await db.runAsync(`
      INSERT INTO chat_participants (tenant_id, conversation_id, user_id)
      VALUES (?, ?, ?)
    `, [tenantId, conversationId, userId1]);

    await db.runAsync(`
      INSERT INTO chat_participants (tenant_id, conversation_id, user_id)
      VALUES (?, ?, ?)
    `, [tenantId, conversationId, userId2]);

    return this.getConversationById(tenantId, conversationId);
  }

  /**
   * Create group conversation
   */
  async createGroupConversation(tenantId, userId, name, participantIds) {
    const result = await db.runAsync(`
      INSERT INTO chat_conversations (tenant_id, conversation_type, name, created_by)
      VALUES (?, 'group', ?, ?)
    `, [tenantId, name, userId]);

    const conversationId = result.lastID;

    // Add creator as participant
    await db.runAsync(`
      INSERT INTO chat_participants (tenant_id, conversation_id, user_id)
      VALUES (?, ?, ?)
    `, [tenantId, conversationId, userId]);

    // Add other participants
    for (const participantId of participantIds) {
      if (participantId !== userId) {
        await db.runAsync(`
          INSERT INTO chat_participants (tenant_id, conversation_id, user_id)
          VALUES (?, ?, ?)
        `, [tenantId, conversationId, participantId]);
      }
    }

    return this.getConversationById(tenantId, conversationId);
  }

  /**
   * Get conversation by ID
   */
  async getConversationById(tenantId, conversationId) {
    const conversation = await db.getAsync(`
      SELECT c.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM chat_conversations c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = ? AND c.tenant_id = ?
    `, [conversationId, tenantId]);

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    conversation.participants = await this.getConversationParticipants(tenantId, conversationId);
    return conversation;
  }

  /**
   * Get conversation participants
   */
  async getConversationParticipants(tenantId, conversationId) {
    return await db.allAsync(`
      SELECT 
        p.user_id,
        p.joined_at,
        p.last_read_at,
        u.first_name,
        u.last_name,
        u.email,
        u.role
      FROM chat_participants p
      JOIN users u ON p.user_id = u.id
      WHERE p.conversation_id = ? AND p.tenant_id = ?
      ORDER BY p.joined_at ASC
    `, [conversationId, tenantId]);
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(tenantId, conversationId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    // Verify user has access to conversation
    const hasAccess = await db.getAsync(`
      SELECT 1 FROM chat_participants
      WHERE conversation_id = ? AND tenant_id = ? AND user_id = ?
    `, [conversationId, tenantId, filters.userId]);

    if (!hasAccess) {
      throw new Error('Access denied to this conversation');
    }

    const messages = await db.allAsync(`
      SELECT 
        m.*,
        u.first_name,
        u.last_name,
        u.email
      FROM chat_messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.conversation_id = ? AND m.tenant_id = ?
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `, [conversationId, tenantId, limit, offset]);

    // Get total count
    const countResult = await db.getAsync(`
      SELECT COUNT(*) as total
      FROM chat_messages
      WHERE conversation_id = ? AND tenant_id = ?
    `, [conversationId, tenantId]);
    const total = countResult?.total || 0;

    // Parse boolean
    const parsedMessages = messages.map(msg => ({
      ...msg,
      is_read: Boolean(msg.is_read)
    }));

    return formatPaginatedResponse(parsedMessages.reverse(), total, page, limit);
  }

  /**
   * Send message
   */
  async sendMessage(tenantId, conversationId, userId, messageData) {
    const { message, messageType = 'text', fileUrl } = messageData;

    if (!message && !fileUrl) {
      throw new Error('Message or file URL is required');
    }

    // Verify user has access
    const hasAccess = await db.getAsync(`
      SELECT 1 FROM chat_participants
      WHERE conversation_id = ? AND tenant_id = ? AND user_id = ?
    `, [conversationId, tenantId, userId]);

    if (!hasAccess) {
      throw new Error('Access denied to this conversation');
    }

    const result = await db.runAsync(`
      INSERT INTO chat_messages (
        tenant_id, conversation_id, user_id, message, message_type, file_url
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `, [tenantId, conversationId, userId, message || null, messageType, fileUrl || null]);

    // Update conversation updated_at
    await db.runAsync(`
      UPDATE chat_conversations
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `, [conversationId, tenantId]);

    // Mark as read for sender
    await db.runAsync(`
      UPDATE chat_messages
      SET is_read = 1, read_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `, [result.lastID, userId]);

    return this.getMessageById(tenantId, result.lastID);
  }

  /**
   * Get message by ID
   */
  async getMessageById(tenantId, messageId) {
    const message = await db.getAsync(`
      SELECT 
        m.*,
        u.first_name,
        u.last_name,
        u.email
      FROM chat_messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.id = ? AND m.tenant_id = ?
    `, [messageId, tenantId]);

    if (!message) {
      throw new Error('Message not found');
    }

    return {
      ...message,
      is_read: Boolean(message.is_read)
    };
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(tenantId, conversationId, userId) {
    await db.runAsync(`
      UPDATE chat_messages
      SET is_read = 1, read_at = CURRENT_TIMESTAMP
      WHERE conversation_id = ? AND tenant_id = ? AND user_id != ? AND is_read = 0
    `, [conversationId, tenantId, userId]);

    await db.runAsync(`
      UPDATE chat_participants
      SET last_read_at = CURRENT_TIMESTAMP
      WHERE conversation_id = ? AND tenant_id = ? AND user_id = ?
    `, [conversationId, tenantId, userId]);

    return { success: true };
  }

  /**
   * Delete message
   */
  async deleteMessage(tenantId, messageId, userId) {
    const message = await this.getMessageById(tenantId, messageId);
    
    // Only allow deletion by message owner
    if (message.user_id !== userId) {
      throw new Error('You can only delete your own messages');
    }

    await db.runAsync(`
      DELETE FROM chat_messages
      WHERE id = ? AND tenant_id = ?
    `, [messageId, tenantId]);

    return { success: true, deleted: message };
  }

  /**
   * Get unread message count for user
   */
  async getUnreadCount(tenantId, userId) {
    const result = await db.getAsync(`
      SELECT COUNT(*) as count
      FROM chat_messages m
      INNER JOIN chat_participants p ON m.conversation_id = p.conversation_id
      WHERE m.tenant_id = ? AND p.user_id = ? AND m.user_id != ? AND m.is_read = 0
    `, [tenantId, userId, userId]);

    return result?.count || 0;
  }
}

module.exports = new ChatService();
