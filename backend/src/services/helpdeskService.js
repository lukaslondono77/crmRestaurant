const db = require('../config/database');
const { parsePaginationParams, formatPaginatedResponse } = require('../utils/pagination');

class HelpdeskService {
  /**
   * Generate unique ticket number
   */
  _generateTicketNumber() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `TKT-${timestamp}-${random}`;
  }

  /**
   * Get all tickets
   */
  async getTickets(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['t.tenant_id = ?'];
    const params = [tenantId];

    if (filters.assignedTo) {
      whereConditions.push('t.assigned_to = ?');
      params.push(filters.assignedTo);
    }

    if (filters.createdBy) {
      whereConditions.push('t.created_by = ?');
      params.push(filters.createdBy);
    }

    if (filters.status) {
      whereConditions.push('t.status = ?');
      params.push(filters.status);
    }

    if (filters.priority) {
      whereConditions.push('t.priority = ?');
      params.push(filters.priority);
    }

    if (filters.category) {
      whereConditions.push('t.category = ?');
      params.push(filters.category);
    }

    if (filters.search) {
      whereConditions.push('(t.subject LIKE ? OR t.description LIKE ? OR t.ticket_number LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM helpdesk_tickets t ${whereClause}`, params);
    const total = countResult?.total || 0;

    const tickets = await db.allAsync(`
      SELECT 
        t.*,
        u1.first_name || ' ' || u1.last_name as created_by_name,
        u1.email as created_by_email,
        u2.first_name || ' ' || u2.last_name as assigned_to_name,
        u2.email as assigned_to_email,
        (SELECT COUNT(*) FROM helpdesk_ticket_comments WHERE ticket_id = t.id) as comment_count
      FROM helpdesk_tickets t
      LEFT JOIN users u1 ON t.created_by = u1.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const parsedTickets = tickets.map(ticket => ({
      ...ticket,
      tags: ticket.tags ? (this._tryParseJSON(ticket.tags) || []) : []
    }));

    return formatPaginatedResponse(parsedTickets, total, page, limit);
  }

  /**
   * Get ticket by ID with comments
   */
  async getTicketById(tenantId, ticketId) {
    const ticket = await db.getAsync(`
      SELECT 
        t.*,
        u1.first_name || ' ' || u1.last_name as created_by_name,
        u1.email as created_by_email,
        u2.first_name || ' ' || u2.last_name as assigned_to_name,
        u2.email as assigned_to_email
      FROM helpdesk_tickets t
      LEFT JOIN users u1 ON t.created_by = u1.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      WHERE t.id = ? AND t.tenant_id = ?
    `, [ticketId, tenantId]);

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Get comments
    ticket.comments = await db.allAsync(`
      SELECT 
        c.*,
        u.first_name || ' ' || u.last_name as user_name,
        u.email as user_email
      FROM helpdesk_ticket_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.ticket_id = ? AND c.tenant_id = ?
      ORDER BY c.created_at ASC
    `, [ticketId, tenantId]);

    ticket.comments = ticket.comments.map(comment => ({
      ...comment,
      is_internal: Boolean(comment.is_internal),
      attachments: comment.attachments ? (this._tryParseJSON(comment.attachments) || []) : []
    }));

    // Get attachments
    ticket.attachments = await db.allAsync(`
      SELECT * FROM helpdesk_ticket_attachments
      WHERE ticket_id = ? AND tenant_id = ?
      ORDER BY created_at ASC
    `, [ticketId, tenantId]);

    return {
      ...ticket,
      tags: ticket.tags ? (this._tryParseJSON(ticket.tags) || []) : []
    };
  }

  /**
   * Create ticket
   */
  async createTicket(tenantId, userId, ticketData) {
    const {
      subject, description, category, priority = 'medium',
      source = 'web', assignedTo, tags
    } = ticketData;

    if (!subject) {
      throw new Error('Ticket subject is required');
    }

    const ticketNumber = this._generateTicketNumber();

    const result = await db.runAsync(`
      INSERT INTO helpdesk_tickets (
        tenant_id, ticket_number, created_by, assigned_to, subject,
        description, category, priority, source, tags
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, ticketNumber, userId, assignedTo || null, subject,
      description || null, category || null, priority, source,
      tags ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : null
    ]);

    return this.getTicketById(tenantId, result.lastID);
  }

  /**
   * Update ticket
   */
  async updateTicket(tenantId, ticketId, updateData) {
    const existing = await this.getTicketById(tenantId, ticketId);

    const updates = [];
    const params = [];

    const fields = {
      assignedTo: 'assigned_to',
      subject: 'subject',
      description: 'description',
      category: 'category',
      priority: 'priority',
      status: 'status',
      resolution: 'resolution'
    };

    Object.keys(fields).forEach(key => {
      if (updateData[key] !== undefined) {
        updates.push(`${fields[key]} = ?`);
        params.push(updateData[key] || null);
      }
    });

    if (updateData.tags !== undefined) {
      updates.push('tags = ?');
      params.push(updateData.tags ? (Array.isArray(updateData.tags) ? JSON.stringify(updateData.tags) : updateData.tags) : null);
    }

    // Handle status changes
    if (updateData.status === 'resolved' && existing.status !== 'resolved') {
      updates.push('resolved_at = CURRENT_TIMESTAMP');
    }

    if (updateData.status === 'closed' && existing.status !== 'closed') {
      updates.push('closed_at = CURRENT_TIMESTAMP');
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(ticketId, tenantId);

    await db.runAsync(`
      UPDATE helpdesk_tickets
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return this.getTicketById(tenantId, ticketId);
  }

  /**
   * Delete ticket
   */
  async deleteTicket(tenantId, ticketId) {
    const existing = await this.getTicketById(tenantId, ticketId);
    await db.runAsync('DELETE FROM helpdesk_tickets WHERE id = ? AND tenant_id = ?', [ticketId, tenantId]);
    return { success: true, deleted: existing };
  }

  /**
   * Add comment to ticket
   */
  async addComment(tenantId, ticketId, userId, commentData) {
    const { comment, isInternal = false, attachments } = commentData;

    if (!comment) {
      throw new Error('Comment text is required');
    }

    const result = await db.runAsync(`
      INSERT INTO helpdesk_ticket_comments (
        tenant_id, ticket_id, user_id, comment, is_internal, attachments
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      tenantId, ticketId, userId, comment, isInternal ? 1 : 0,
      attachments ? (Array.isArray(attachments) ? JSON.stringify(attachments) : attachments) : null
    ]);

    // Update ticket updated_at
    await db.runAsync(`
      UPDATE helpdesk_tickets
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `, [ticketId, tenantId]);

    return await db.getAsync(`
      SELECT 
        c.*,
        u.first_name || ' ' || u.last_name as user_name,
        u.email as user_email
      FROM helpdesk_ticket_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [result.lastID]);
  }

  /**
   * Get agents
   */
  async getAgents(tenantId) {
    const agents = await db.allAsync(`
      SELECT 
        a.*,
        u.first_name || ' ' || u.last_name as agent_name,
        u.email as agent_email,
        (SELECT COUNT(*) FROM helpdesk_tickets WHERE assigned_to = a.user_id AND status NOT IN ('resolved', 'closed')) as active_tickets
      FROM helpdesk_agents a
      JOIN users u ON a.user_id = u.id
      WHERE a.tenant_id = ? AND a.is_active = 1
    `, [tenantId]);

    return agents.map(agent => ({
      ...agent,
      is_active: Boolean(agent.is_active)
    }));
  }

  /**
   * Add agent
   */
  async addAgent(tenantId, userId, agentData) {
    const { department, maxTickets = 10 } = agentData;

    await db.runAsync(`
      INSERT OR REPLACE INTO helpdesk_agents (tenant_id, user_id, department, max_tickets, is_active)
      VALUES (?, ?, ?, ?, 1)
    `, [tenantId, userId, department || null, maxTickets]);

    return await db.getAsync(`
      SELECT 
        a.*,
        u.first_name || ' ' || u.last_name as agent_name,
        u.email as agent_email
      FROM helpdesk_agents a
      JOIN users u ON a.user_id = u.id
      WHERE a.user_id = ? AND a.tenant_id = ?
    `, [userId, tenantId]);
  }

  /**
   * Get ticket statistics
   */
  async getTicketStats(tenantId, filters = {}) {
    let whereConditions = ['tenant_id = ?'];
    const params = [tenantId];

    if (filters.assignedTo) {
      whereConditions.push('assigned_to = ?');
      params.push(filters.assignedTo);
    }

    if (filters.createdBy) {
      whereConditions.push('created_by = ?');
      params.push(filters.createdBy);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const stats = await db.getAsync(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
        SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent,
        SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN priority = 'medium' THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN priority = 'low' THEN 1 ELSE 0 END) as low
      FROM helpdesk_tickets
      ${whereClause}
    `, params);

    return stats || {
      total: 0,
      open: 0,
      in_progress: 0,
      waiting: 0,
      resolved: 0,
      closed: 0,
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0
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

module.exports = new HelpdeskService();
