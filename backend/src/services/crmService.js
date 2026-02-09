const db = require('../config/database');
const { parsePaginationParams, formatPaginatedResponse } = require('../utils/pagination');

class CrmService {
  /**
   * Get all leads
   */
  async getLeads(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['l.tenant_id = ?'];
    const params = [tenantId];

    if (filters.userId) {
      whereConditions.push('l.user_id = ?');
      params.push(filters.userId);
    }

    if (filters.status) {
      whereConditions.push('l.status = ?');
      params.push(filters.status);
    }

    if (filters.source) {
      whereConditions.push('l.source = ?');
      params.push(filters.source);
    }

    if (filters.search) {
      whereConditions.push('(l.first_name LIKE ? OR l.last_name LIKE ? OR l.email LIKE ? OR l.company LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM crm_leads l ${whereClause}`, params);
    const total = countResult?.total || 0;

    const leads = await db.allAsync(`
      SELECT 
        l.*,
        u.first_name || ' ' || u.last_name as assigned_to_name
      FROM crm_leads l
      LEFT JOIN users u ON l.user_id = u.id
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const parsedLeads = leads.map(lead => ({
      ...lead,
      tags: lead.tags ? (this._tryParseJSON(lead.tags) || []) : []
    }));

    return formatPaginatedResponse(parsedLeads, total, page, limit);
  }

  /**
   * Get lead by ID
   */
  async getLeadById(tenantId, leadId) {
    const lead = await db.getAsync(`
      SELECT 
        l.*,
        u.first_name || ' ' || u.last_name as assigned_to_name
      FROM crm_leads l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE l.id = ? AND l.tenant_id = ?
    `, [leadId, tenantId]);

    if (!lead) {
      throw new Error('Lead not found');
    }

    return {
      ...lead,
      tags: lead.tags ? (this._tryParseJSON(lead.tags) || []) : []
    };
  }

  /**
   * Create lead
   */
  async createLead(tenantId, leadData) {
    const {
      firstName, lastName, email, phone, company, jobTitle,
      source, status = 'new', priority = 'medium', estimatedValue,
      userId, notes, tags
    } = leadData;

    if (!firstName) {
      throw new Error('First name is required');
    }

    const result = await db.runAsync(`
      INSERT INTO crm_leads (
        tenant_id, user_id, first_name, last_name, email, phone, company,
        job_title, source, status, priority, estimated_value, notes, tags
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, userId || null, firstName, lastName || null, email || null,
      phone || null, company || null, jobTitle || null, source || null,
      status, priority, estimatedValue || null, notes || null,
      tags ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : null
    ]);

    return this.getLeadById(tenantId, result.lastID);
  }

  /**
   * Update lead
   */
  async updateLead(tenantId, leadId, updateData) {
    const existing = await this.getLeadById(tenantId, leadId);

    const updates = [];
    const params = [];

    const fields = {
      firstName: 'first_name',
      lastName: 'last_name',
      email: 'email',
      phone: 'phone',
      company: 'company',
      jobTitle: 'job_title',
      source: 'source',
      status: 'status',
      priority: 'priority',
      estimatedValue: 'estimated_value',
      userId: 'user_id',
      notes: 'notes'
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

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(leadId, tenantId);

    await db.runAsync(`
      UPDATE crm_leads
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return this.getLeadById(tenantId, leadId);
  }

  /**
   * Delete lead
   */
  async deleteLead(tenantId, leadId) {
    const existing = await this.getLeadById(tenantId, leadId);
    await db.runAsync('DELETE FROM crm_leads WHERE id = ? AND tenant_id = ?', [leadId, tenantId]);
    return { success: true, deleted: existing };
  }

  /**
   * Get all deals
   */
  async getDeals(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['d.tenant_id = ?'];
    const params = [tenantId];

    if (filters.userId) {
      whereConditions.push('d.user_id = ?');
      params.push(filters.userId);
    }

    if (filters.stage) {
      whereConditions.push('d.stage = ?');
      params.push(filters.stage);
    }

    if (filters.leadId) {
      whereConditions.push('d.lead_id = ?');
      params.push(filters.leadId);
    }

    if (filters.search) {
      whereConditions.push('(d.name LIKE ? OR d.description LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM crm_deals d ${whereClause}`, params);
    const total = countResult?.total || 0;

    const deals = await db.allAsync(`
      SELECT 
        d.*,
        u.first_name || ' ' || u.last_name as assigned_to_name,
        l.first_name || ' ' || l.last_name as lead_name
      FROM crm_deals d
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN crm_leads l ON d.lead_id = l.id
      ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const parsedDeals = deals.map(deal => ({
      ...deal,
      tags: deal.tags ? (this._tryParseJSON(deal.tags) || []) : []
    }));

    return formatPaginatedResponse(parsedDeals, total, page, limit);
  }

  /**
   * Get deal by ID
   */
  async getDealById(tenantId, dealId) {
    const deal = await db.getAsync(`
      SELECT 
        d.*,
        u.first_name || ' ' || u.last_name as assigned_to_name,
        l.first_name || ' ' || l.last_name as lead_name
      FROM crm_deals d
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN crm_leads l ON d.lead_id = l.id
      WHERE d.id = ? AND d.tenant_id = ?
    `, [dealId, tenantId]);

    if (!deal) {
      throw new Error('Deal not found');
    }

    return {
      ...deal,
      tags: deal.tags ? (this._tryParseJSON(deal.tags) || []) : []
    };
  }

  /**
   * Create deal
   */
  async createDeal(tenantId, dealData) {
    const {
      leadId, userId, name, description, value, stage = 'prospecting',
      probability = 0, expectedCloseDate, notes, tags
    } = dealData;

    if (!name || !value) {
      throw new Error('Deal name and value are required');
    }

    const result = await db.runAsync(`
      INSERT INTO crm_deals (
        tenant_id, lead_id, user_id, name, description, value, stage,
        probability, expected_close_date, notes, tags
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, leadId || null, userId || null, name, description || null,
      value, stage, probability, expectedCloseDate || null, notes || null,
      tags ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : null
    ]);

    return this.getDealById(tenantId, result.lastID);
  }

  /**
   * Update deal
   */
  async updateDeal(tenantId, dealId, updateData) {
    const existing = await this.getDealById(tenantId, dealId);

    const updates = [];
    const params = [];

    const fields = {
      leadId: 'lead_id',
      userId: 'user_id',
      name: 'name',
      description: 'description',
      value: 'value',
      stage: 'stage',
      probability: 'probability',
      expectedCloseDate: 'expected_close_date',
      actualCloseDate: 'actual_close_date',
      notes: 'notes'
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

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(dealId, tenantId);

    await db.runAsync(`
      UPDATE crm_deals
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return this.getDealById(tenantId, dealId);
  }

  /**
   * Delete deal
   */
  async deleteDeal(tenantId, dealId) {
    const existing = await this.getDealById(tenantId, dealId);
    await db.runAsync('DELETE FROM crm_deals WHERE id = ? AND tenant_id = ?', [dealId, tenantId]);
    return { success: true, deleted: existing };
  }

  /**
   * Get activities
   */
  async getActivities(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['a.tenant_id = ?'];
    const params = [tenantId];

    if (filters.leadId) {
      whereConditions.push('a.lead_id = ?');
      params.push(filters.leadId);
    }

    if (filters.dealId) {
      whereConditions.push('a.deal_id = ?');
      params.push(filters.dealId);
    }

    if (filters.contactId) {
      whereConditions.push('a.contact_id = ?');
      params.push(filters.contactId);
    }

    if (filters.activityType) {
      whereConditions.push('a.activity_type = ?');
      params.push(filters.activityType);
    }

    if (filters.isCompleted !== undefined) {
      whereConditions.push('a.is_completed = ?');
      params.push(filters.isCompleted ? 1 : 0);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM crm_activities a ${whereClause}`, params);
    const total = countResult?.total || 0;

    const activities = await db.allAsync(`
      SELECT 
        a.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM crm_activities a
      LEFT JOIN users u ON a.user_id = u.id
      ${whereClause}
      ORDER BY a.due_date ASC, a.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return formatPaginatedResponse(activities.map(a => ({
      ...a,
      is_completed: Boolean(a.is_completed)
    })), total, page, limit);
  }

  /**
   * Create activity
   */
  async createActivity(tenantId, userId, activityData) {
    const {
      leadId, dealId, contactId, activityType, subject, description,
      dueDate, isCompleted = false
    } = activityData;

    if (!activityType || !subject) {
      throw new Error('Activity type and subject are required');
    }

    const result = await db.runAsync(`
      INSERT INTO crm_activities (
        tenant_id, user_id, lead_id, deal_id, contact_id, activity_type,
        subject, description, due_date, is_completed, completed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, userId, leadId || null, dealId || null, contactId || null,
      activityType, subject, description || null, dueDate || null,
      isCompleted ? 1 : 0, isCompleted ? new Date().toISOString() : null
    ]);

    return await db.getAsync('SELECT * FROM crm_activities WHERE id = ?', [result.lastID]);
  }

  /**
   * Update activity
   */
  async updateActivity(tenantId, activityId, updateData) {
    const updates = [];
    const params = [];

    const fields = {
      subject: 'subject',
      description: 'description',
      dueDate: 'due_date',
      activityType: 'activity_type'
    };

    Object.keys(fields).forEach(key => {
      if (updateData[key] !== undefined) {
        updates.push(`${fields[key]} = ?`);
        params.push(updateData[key] || null);
      }
    });

    if (updateData.isCompleted !== undefined) {
      updates.push('is_completed = ?');
      updates.push('completed_at = ?');
      params.push(updateData.isCompleted ? 1 : 0);
      params.push(updateData.isCompleted ? new Date().toISOString() : null);
    }

    if (updates.length === 0) {
      return await db.getAsync('SELECT * FROM crm_activities WHERE id = ? AND tenant_id = ?', [activityId, tenantId]);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(activityId, tenantId);

    await db.runAsync(`
      UPDATE crm_activities
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return await db.getAsync('SELECT * FROM crm_activities WHERE id = ?', [activityId]);
  }

  /**
   * Get CRM statistics
   */
  async getCrmStats(tenantId, filters = {}) {
    let whereConditions = ['tenant_id = ?'];
    const params = [tenantId];

    if (filters.userId) {
      whereConditions.push('user_id = ?');
      params.push(filters.userId);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const stats = await db.getAsync(`
      SELECT 
        (SELECT COUNT(*) FROM crm_leads ${whereClause.replace('tenant_id', 'l.tenant_id').replace('user_id', 'l.user_id')}) as total_leads,
        (SELECT COUNT(*) FROM crm_leads ${whereClause.replace('tenant_id', 'l.tenant_id').replace('user_id', 'l.user_id')} AND status = 'new') as new_leads,
        (SELECT COUNT(*) FROM crm_leads ${whereClause.replace('tenant_id', 'l.tenant_id').replace('user_id', 'l.user_id')} AND status = 'qualified') as qualified_leads,
        (SELECT COUNT(*) FROM crm_deals ${whereClause.replace('tenant_id', 'd.tenant_id').replace('user_id', 'd.user_id')}) as total_deals,
        (SELECT SUM(value) FROM crm_deals ${whereClause.replace('tenant_id', 'd.tenant_id').replace('user_id', 'd.user_id')} AND stage != 'closed_lost') as pipeline_value,
        (SELECT SUM(value) FROM crm_deals ${whereClause.replace('tenant_id', 'd.tenant_id').replace('user_id', 'd.user_id')} AND stage = 'closed_won') as won_value
      FROM tenants WHERE id = ?
    `, [tenantId]);

    return stats || {
      total_leads: 0,
      new_leads: 0,
      qualified_leads: 0,
      total_deals: 0,
      pipeline_value: 0,
      won_value: 0
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

module.exports = new CrmService();
