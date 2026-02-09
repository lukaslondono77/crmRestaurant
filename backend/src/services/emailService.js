const db = require('../config/database');
const { parsePaginationParams, formatPaginatedResponse } = require('../utils/pagination');

class EmailService {
  /**
   * Get all emails with filters and pagination
   */
  async getEmails(tenantId, userId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    const alias = 'e';
    let whereConditions = [`${alias}.tenant_id = ?`];
    const params = [tenantId];

    // Filter by folder
    if (filters.folder) {
      whereConditions.push(`${alias}.folder = ?`);
      params.push(filters.folder);
    } else {
      whereConditions.push(`${alias}.folder = ?`);
      params.push('inbox');
    }

    // Filter by status
    if (filters.status) {
      whereConditions.push(`${alias}.status = ?`);
      params.push(filters.status);
    }

    // Filter by user (for sent folder, show emails sent by user; for inbox, show emails to user)
    if (filters.folder === 'sent') {
      whereConditions.push(`${alias}.user_id = ?`);
      params.push(userId);
    } else {
      const userEmail = await db.getAsync('SELECT email FROM users WHERE id = ?', [userId]);
      if (userEmail?.email) {
        whereConditions.push(`(${alias}.to_emails LIKE ? OR ${alias}.cc_emails LIKE ? OR ${alias}.bcc_emails LIKE ?)`);
        const emailPattern = `%${userEmail.email}%`;
        params.push(emailPattern, emailPattern, emailPattern);
      }
    }

    // Filter drafts
    if (filters.isDraft !== undefined) {
      whereConditions.push(`${alias}.is_draft = ?`);
      params.push(filters.isDraft ? 1 : 0);
    }

    // Filter starred
    if (filters.isStarred !== undefined) {
      whereConditions.push(`${alias}.is_starred = ?`);
      params.push(filters.isStarred ? 1 : 0);
    }

    // Filter important
    if (filters.isImportant !== undefined) {
      whereConditions.push(`${alias}.is_important = ?`);
      params.push(filters.isImportant ? 1 : 0);
    }

    // Search by subject or body
    if (filters.search) {
      whereConditions.push(`(${alias}.subject LIKE ? OR ${alias}.body LIKE ?)`);
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM emails ${alias} ${whereClause}`;
    const countResult = await db.getAsync(countQuery, params);
    const total = countResult?.total || 0;

    // Get emails
    const orderBy = filters.orderBy || 'e.created_at DESC';
    const emailsQuery = `
      SELECT 
        e.*,
        u.first_name || ' ' || u.last_name as sender_name,
        u.email as sender_email
      FROM emails e
      LEFT JOIN users u ON e.user_id = u.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;
    
    const emails = await db.allAsync(emailsQuery, [...params, limit, offset]);

    // Parse JSON fields and get attachments
    const parsedEmails = [];
    for (const email of emails) {
      const parsed = {
        ...email,
        is_draft: Boolean(email.is_draft),
        is_important: Boolean(email.is_important),
        is_starred: Boolean(email.is_starred),
        has_attachments: Boolean(email.has_attachments),
        to_emails: email.to_emails ? (this._tryParseJSON(email.to_emails) || email.to_emails.split(',')) : [],
        cc_emails: email.cc_emails ? (this._tryParseJSON(email.cc_emails) || email.cc_emails.split(',')) : [],
        bcc_emails: email.bcc_emails ? (this._tryParseJSON(email.bcc_emails) || email.bcc_emails.split(',')) : []
      };

      // Get attachments
      if (parsed.has_attachments) {
        parsed.attachments = await this.getEmailAttachments(tenantId, email.id);
      } else {
        parsed.attachments = [];
      }

      parsedEmails.push(parsed);
    }

    return formatPaginatedResponse(parsedEmails, total, page, limit);
  }

  /**
   * Get single email by ID
   */
  async getEmailById(tenantId, emailId, userId) {
    const email = await db.getAsync(`
      SELECT 
        e.*,
        u.first_name || ' ' || u.last_name as sender_name,
        u.email as sender_email
      FROM emails e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.id = ? AND e.tenant_id = ?
    `, [emailId, tenantId]);

    if (!email) {
      throw new Error('Email not found');
    }

    // Mark as read if in inbox
    if (email.folder === 'inbox' && email.status === 'unread') {
      await db.runAsync(`
        UPDATE emails
        SET status = 'read', read_at = CURRENT_TIMESTAMP
        WHERE id = ? AND tenant_id = ?
      `, [emailId, tenantId]);
      email.status = 'read';
      email.read_at = new Date().toISOString();
    }

    const parsed = {
      ...email,
      is_draft: Boolean(email.is_draft),
      is_important: Boolean(email.is_important),
      is_starred: Boolean(email.is_starred),
      has_attachments: Boolean(email.has_attachments),
      to_emails: email.to_emails ? (this._tryParseJSON(email.to_emails) || email.to_emails.split(',')) : [],
      cc_emails: email.cc_emails ? (this._tryParseJSON(email.cc_emails) || email.cc_emails.split(',')) : [],
      bcc_emails: email.bcc_emails ? (this._tryParseJSON(email.bcc_emails) || email.bcc_emails.split(',')) : []
    };

    // Get attachments
    parsed.attachments = await this.getEmailAttachments(tenantId, emailId);

    return parsed;
  }

  /**
   * Get email attachments
   */
  async getEmailAttachments(tenantId, emailId) {
    return await db.allAsync(`
      SELECT * FROM email_attachments
      WHERE email_id = ? AND tenant_id = ?
      ORDER BY created_at ASC
    `, [emailId, tenantId]);
  }

  /**
   * Create/send email
   */
  async createEmail(tenantId, userId, emailData) {
    const {
      subject,
      body,
      bodyHtml,
      fromEmail,
      fromName,
      toEmails,
      ccEmails,
      bccEmails,
      replyToEmail,
      folder = 'sent',
      isDraft = false,
      isImportant = false,
      isStarred = false,
      parentEmailId,
      threadId,
      attachments
    } = emailData;

    if (!subject || !body || !toEmails) {
      throw new Error('Subject, body, and to emails are required');
    }

    // Get user email if not provided
    const user = await db.getAsync('SELECT email, first_name, last_name FROM users WHERE id = ?', [userId]);
    const finalFromEmail = fromEmail || user?.email;
    const finalFromName = fromName || `${user?.first_name || ''} ${user?.last_name || ''}`.trim();

    // Generate thread ID if replying
    let finalThreadId = threadId;
    if (parentEmailId && !threadId) {
      const parent = await db.getAsync('SELECT thread_id FROM emails WHERE id = ?', [parentEmailId]);
      finalThreadId = parent?.thread_id || parentEmailId;
    } else if (!finalThreadId) {
      // New thread - will be set after insert
      finalThreadId = null;
    }

    const result = await db.runAsync(`
      INSERT INTO emails (
        tenant_id, user_id, subject, body, body_html, from_email, from_name,
        to_emails, cc_emails, bcc_emails, reply_to_email, folder, status,
        is_draft, is_important, is_starred, has_attachments, parent_email_id, thread_id, sent_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId,
      userId,
      subject,
      body,
      bodyHtml || null,
      finalFromEmail,
      finalFromName,
      Array.isArray(toEmails) ? JSON.stringify(toEmails) : toEmails,
      ccEmails ? (Array.isArray(ccEmails) ? JSON.stringify(ccEmails) : ccEmails) : null,
      bccEmails ? (Array.isArray(bccEmails) ? JSON.stringify(bccEmails) : bccEmails) : null,
      replyToEmail || null,
      isDraft ? 'draft' : folder,
      'unread',
      isDraft ? 1 : 0,
      isImportant ? 1 : 0,
      isStarred ? 1 : 0,
      attachments && attachments.length > 0 ? 1 : 0,
      parentEmailId || null,
      finalThreadId,
      isDraft ? null : new Date().toISOString()
    ]);

    const emailId = result.lastID;

    // Update thread_id if it's a new thread
    if (!finalThreadId) {
      await db.runAsync('UPDATE emails SET thread_id = ? WHERE id = ?', [emailId, emailId]);
    }

    // Save attachments
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        await db.runAsync(`
          INSERT INTO email_attachments (
            tenant_id, email_id, file_name, file_path, file_size, file_type
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          tenantId,
          emailId,
          attachment.fileName,
          attachment.filePath,
          attachment.fileSize || null,
          attachment.fileType || null
        ]);
      }
    }

    return this.getEmailById(tenantId, emailId, userId);
  }

  /**
   * Update email (for drafts, status changes, etc.)
   */
  async updateEmail(tenantId, emailId, userId, updateData) {
    const existing = await this.getEmailById(tenantId, emailId, userId);

    const updates = [];
    const params = [];

    const fields = {
      subject: 'subject',
      body: 'body',
      bodyHtml: 'body_html',
      folder: 'folder',
      status: 'status',
      isDraft: 'is_draft',
      isImportant: 'is_important',
      isStarred: 'is_starred'
    };

    Object.keys(fields).forEach(key => {
      if (updateData[key] !== undefined) {
        if (key === 'isDraft' || key === 'isImportant' || key === 'isStarred') {
          updates.push(`${fields[key]} = ?`);
          params.push(updateData[key] ? 1 : 0);
        } else {
          updates.push(`${fields[key]} = ?`);
          params.push(updateData[key] || null);
        }
      }
    });

    // Handle sent_at when sending draft
    if (updateData.isDraft === false && existing.is_draft) {
      updates.push('sent_at = CURRENT_TIMESTAMP');
      updates.push('folder = ?');
      params.push('sent');
    }

    if (updateData.toEmails !== undefined) {
      updates.push('to_emails = ?');
      params.push(Array.isArray(updateData.toEmails) ? JSON.stringify(updateData.toEmails) : updateData.toEmails);
    }

    if (updateData.ccEmails !== undefined) {
      updates.push('cc_emails = ?');
      params.push(updateData.ccEmails ? (Array.isArray(updateData.ccEmails) ? JSON.stringify(updateData.ccEmails) : updateData.ccEmails) : null);
    }

    if (updateData.bccEmails !== undefined) {
      updates.push('bcc_emails = ?');
      params.push(updateData.bccEmails ? (Array.isArray(updateData.bccEmails) ? JSON.stringify(updateData.bccEmails) : updateData.bccEmails) : null);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(emailId, tenantId);

    await db.runAsync(`
      UPDATE emails
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return this.getEmailById(tenantId, emailId, userId);
  }

  /**
   * Delete email (move to trash)
   */
  async deleteEmail(tenantId, emailId) {
    const existing = await this.getEmailById(tenantId, emailId, null);
    
    await db.runAsync(`
      UPDATE emails
      SET folder = 'trash', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `, [emailId, tenantId]);

    return { success: true, movedToTrash: existing };
  }

  /**
   * Permanently delete email
   */
  async permanentlyDeleteEmail(tenantId, emailId) {
    const existing = await this.getEmailById(tenantId, emailId, null);
    
    // Delete attachments first
    await db.runAsync(`
      DELETE FROM email_attachments
      WHERE email_id = ? AND tenant_id = ?
    `, [emailId, tenantId]);

    // Delete email
    await db.runAsync(`
      DELETE FROM emails
      WHERE id = ? AND tenant_id = ?
    `, [emailId, tenantId]);

    return { success: true, deleted: existing };
  }

  /**
   * Get email statistics
   */
  async getEmailStats(tenantId, userId) {
    const userEmail = await db.getAsync('SELECT email FROM users WHERE id = ?', [userId]);
    const emailPattern = userEmail?.email ? `%${userEmail.email}%` : '';

    const stats = await db.getAsync(`
      SELECT 
        SUM(CASE WHEN folder = 'inbox' AND (to_emails LIKE ? OR cc_emails LIKE ? OR bcc_emails LIKE ?) THEN 1 ELSE 0 END) as inbox,
        SUM(CASE WHEN folder = 'sent' AND user_id = ? THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN folder = 'draft' AND user_id = ? THEN 1 ELSE 0 END) as drafts,
        SUM(CASE WHEN folder = 'trash' THEN 1 ELSE 0 END) as trash,
        SUM(CASE WHEN folder = 'inbox' AND status = 'unread' AND (to_emails LIKE ? OR cc_emails LIKE ? OR bcc_emails LIKE ?) THEN 1 ELSE 0 END) as unread,
        SUM(CASE WHEN is_starred = 1 THEN 1 ELSE 0 END) as starred,
        SUM(CASE WHEN is_important = 1 THEN 1 ELSE 0 END) as important
      FROM emails
      WHERE tenant_id = ?
    `, [emailPattern, emailPattern, emailPattern, userId, userId, emailPattern, emailPattern, emailPattern, tenantId]);

    return stats || {
      inbox: 0,
      sent: 0,
      drafts: 0,
      trash: 0,
      unread: 0,
      starred: 0,
      important: 0
    };
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

module.exports = new EmailService();
