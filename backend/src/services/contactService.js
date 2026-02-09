const db = require('../config/database');
const { parsePaginationParams, formatPaginatedResponse } = require('../utils/pagination');

class ContactService {
  _formatContact(contact) {
    if (!contact) return contact;
    const statusLabel = contact.status === 'active' ? 'Active' : 'Deactive';
    return {
      ...contact,
      full_name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
      status_label: statusLabel
    };
  }

  /**
   * Get all contacts with filters and pagination
   */
  async getContacts(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    const alias = 'c';
    let whereConditions = [`${alias}.tenant_id = ?`];
    const params = [tenantId];

    // Filter by contact type
    if (filters.contactType) {
      whereConditions.push(`${alias}.contact_type = ?`);
      params.push(filters.contactType);
    }

    // Filter by status
    if (filters.status) {
      whereConditions.push(`${alias}.status = ?`);
      params.push(filters.status);
    }

    // Filter by user_id (created by)
    if (filters.userId) {
      whereConditions.push(`${alias}.user_id = ?`);
      params.push(filters.userId);
    }

    // Filter by company
    if (filters.company) {
      whereConditions.push(`${alias}.company = ?`);
      params.push(filters.company);
    }

    // Search by name, email, phone, or company
    if (filters.search) {
      whereConditions.push(`(${alias}.first_name LIKE ? OR ${alias}.last_name LIKE ? OR ${alias}.email LIKE ? OR ${alias}.phone LIKE ? OR ${alias}.company LIKE ?)`);
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM contacts ${alias} ${whereClause}`;
    const countResult = await db.getAsync(countQuery, params);
    const total = countResult?.total || 0;

    // Get contacts
    const orderBy = filters.orderBy || 'c.first_name ASC, c.last_name ASC';
    const contactsQuery = `
      SELECT 
        c.*,
        u.first_name || ' ' || u.last_name as created_by_name,
        u.email as created_by_email
      FROM contacts c
      LEFT JOIN users u ON c.user_id = u.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;
    
    const contacts = await db.allAsync(contactsQuery, [...params, limit, offset]);

    // Parse JSON fields
    const parsedContacts = contacts.map(contact => this._formatContact({
      ...contact,
      tags: contact.tags ? (this._tryParseJSON(contact.tags) || []) : [],
      social_links: contact.social_links ? (this._tryParseJSON(contact.social_links) || {}) : {},
      custom_fields: contact.custom_fields ? (this._tryParseJSON(contact.custom_fields) || {}) : {}
    }));

    return formatPaginatedResponse(parsedContacts, total, page, limit);
  }

  /**
   * Get single contact by ID
   */
  async getContactById(tenantId, contactId) {
    const contact = await db.getAsync(`
      SELECT 
        c.*,
        u.first_name || ' ' || u.last_name as created_by_name,
        u.email as created_by_email
      FROM contacts c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = ? AND c.tenant_id = ?
    `, [contactId, tenantId]);

    if (!contact) {
      throw new Error('Contact not found');
    }

    return this._formatContact({
      ...contact,
      tags: contact.tags ? (this._tryParseJSON(contact.tags) || []) : [],
      social_links: contact.social_links ? (this._tryParseJSON(contact.social_links) || {}) : {},
      custom_fields: contact.custom_fields ? (this._tryParseJSON(contact.custom_fields) || {}) : {}
    });
  }

  /**
   * Create new contact
   */
  async createContact(tenantId, userId, contactData) {
    const firstName = contactData.firstName ?? contactData.first_name;
    const lastName = contactData.lastName ?? contactData.last_name;
    const email = contactData.email;
    const phone = contactData.phone;
    const mobile = contactData.mobile;
    const company = contactData.company;
    const jobTitle = contactData.jobTitle ?? contactData.job_title;
    const address = contactData.address;
    const city = contactData.city;
    const state = contactData.state;
    const zipCode = contactData.zipCode ?? contactData.zip_code;
    const country = contactData.country;
    const website = contactData.website;
    const contactType = contactData.contactType ?? contactData.contact_type ?? 'contact';
    const rawStatus = contactData.status ?? 'active';
    const tags = contactData.tags;
    const notes = contactData.notes;
    const avatarUrl = contactData.avatarUrl ?? contactData.avatar_url;
    const socialLinks = contactData.socialLinks ?? contactData.social_links;
    const customFields = contactData.customFields ?? contactData.custom_fields;
    const contactId = contactData.contactId ?? contactData.contact_id;
    const leadScore = contactData.leadScore ?? contactData.lead_score;
    const lastContacted = contactData.lastContacted ?? contactData.last_contacted;

    if (!firstName) {
      throw new Error('First name is required');
    }

    // Validate contact type
    const validTypes = ['contact', 'customer', 'supplier', 'vendor', 'partner'];
    if (!validTypes.includes(contactType)) {
      throw new Error(`Invalid contact type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Validate status
    const validStatuses = ['active', 'inactive', 'archived'];
    const normalizedStatus = typeof rawStatus === 'string' && rawStatus.toLowerCase() === 'deactive'
      ? 'inactive'
      : String(rawStatus || '').toLowerCase();
    const status = normalizedStatus || 'active';
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const result = await db.runAsync(`
      INSERT INTO contacts (
        tenant_id, user_id, contact_id, first_name, last_name, email, phone, mobile,
        company, job_title, address, city, state, zip_code, country,
        website, contact_type, status, tags, notes, avatar_url,
        social_links, custom_fields, lead_score, last_contacted
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId,
      userId,
      contactId || `#ARP-${Math.floor(1000 + Math.random() * 9000)}`,
      firstName,
      lastName || null,
      email || null,
      phone || null,
      mobile || null,
      company || null,
      jobTitle || null,
      address || null,
      city || null,
      state || null,
      zipCode || null,
      country || null,
      website || null,
      contactType,
      status,
      tags ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : null,
      notes || null,
      avatarUrl || null,
      socialLinks ? (typeof socialLinks === 'object' ? JSON.stringify(socialLinks) : socialLinks) : null,
      customFields ? (typeof customFields === 'object' ? JSON.stringify(customFields) : customFields) : null,
      leadScore || 0,
      lastContacted || null
    ]);

    return this.getContactById(tenantId, result.lastID);
  }

  /**
   * Update contact
   */
  async updateContact(tenantId, contactId, updateData) {
    const existing = await this.getContactById(tenantId, contactId);

    const updates = [];
    const params = [];

    const fields = {
      firstName: 'first_name',
      lastName: 'last_name',
      email: 'email',
      phone: 'phone',
      mobile: 'mobile',
      company: 'company',
      jobTitle: 'job_title',
      address: 'address',
      city: 'city',
      state: 'state',
      zipCode: 'zip_code',
      country: 'country',
      website: 'website',
      contactType: 'contact_type',
      status: 'status',
      notes: 'notes',
      avatarUrl: 'avatar_url',
      contactId: 'contact_id',
      leadScore: 'lead_score',
      lastContacted: 'last_contacted'
    };

    if (updateData.first_name !== undefined) updateData.firstName = updateData.first_name;
    if (updateData.last_name !== undefined) updateData.lastName = updateData.last_name;
    if (updateData.job_title !== undefined) updateData.jobTitle = updateData.job_title;
    if (updateData.zip_code !== undefined) updateData.zipCode = updateData.zip_code;
    if (updateData.contact_type !== undefined) updateData.contactType = updateData.contact_type;
    if (updateData.avatar_url !== undefined) updateData.avatarUrl = updateData.avatar_url;
    if (updateData.contact_id !== undefined) updateData.contactId = updateData.contact_id;
    if (updateData.lead_score !== undefined) updateData.leadScore = updateData.lead_score;
    if (updateData.last_contacted !== undefined) updateData.lastContacted = updateData.last_contacted;

    Object.keys(fields).forEach(key => {
      if (updateData[key] !== undefined) {
        updates.push(`${fields[key]} = ?`);
        params.push(updateData[key] || null);
      }
    });

    // Handle JSON fields
    if (updateData.tags !== undefined) {
      updates.push('tags = ?');
      params.push(updateData.tags ? (Array.isArray(updateData.tags) ? JSON.stringify(updateData.tags) : updateData.tags) : null);
    }

    if (updateData.socialLinks !== undefined) {
      updates.push('social_links = ?');
      params.push(updateData.socialLinks ? (typeof updateData.socialLinks === 'object' ? JSON.stringify(updateData.socialLinks) : updateData.socialLinks) : null);
    }

    if (updateData.customFields !== undefined) {
      updates.push('custom_fields = ?');
      params.push(updateData.customFields ? (typeof updateData.customFields === 'object' ? JSON.stringify(updateData.customFields) : updateData.customFields) : null);
    }

    // Validate enums
    if (updateData.contactType !== undefined) {
      const validTypes = ['contact', 'customer', 'supplier', 'vendor', 'partner'];
      if (!validTypes.includes(updateData.contactType)) {
        throw new Error(`Invalid contact type. Must be one of: ${validTypes.join(', ')}`);
      }
    }

    if (updateData.status !== undefined) {
      const validStatuses = ['active', 'inactive', 'archived'];
      const normalizedStatus = typeof updateData.status === 'string' && updateData.status.toLowerCase() === 'deactive'
        ? 'inactive'
        : String(updateData.status || '').toLowerCase();
      if (!validStatuses.includes(normalizedStatus)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
      updateData.status = normalizedStatus;
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(contactId, tenantId);

    await db.runAsync(`
      UPDATE contacts
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return this.getContactById(tenantId, contactId);
  }

  /**
   * Delete contact
   */
  async deleteContact(tenantId, contactId) {
    const existing = await this.getContactById(tenantId, contactId);
    
    await db.runAsync(`
      DELETE FROM contacts
      WHERE id = ? AND tenant_id = ?
    `, [contactId, tenantId]);

    return { success: true, deleted: existing };
  }

  /**
   * Get contact statistics
   */
  async getContactStats(tenantId, filters = {}) {
    let whereConditions = ['tenant_id = ?'];
    const params = [tenantId];

    if (filters.userId) {
      whereConditions.push('user_id = ?');
      params.push(filters.userId);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const stats = await db.getAsync(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived,
        SUM(CASE WHEN contact_type = 'contact' THEN 1 ELSE 0 END) as contacts,
        SUM(CASE WHEN contact_type = 'customer' THEN 1 ELSE 0 END) as customers,
        SUM(CASE WHEN contact_type = 'supplier' THEN 1 ELSE 0 END) as suppliers,
        SUM(CASE WHEN contact_type = 'vendor' THEN 1 ELSE 0 END) as vendors,
        SUM(CASE WHEN contact_type = 'partner' THEN 1 ELSE 0 END) as partners
      FROM contacts
      ${whereClause}
    `, params);

    return stats || {
      total: 0,
      active: 0,
      inactive: 0,
      archived: 0,
      contacts: 0,
      customers: 0,
      suppliers: 0,
      vendors: 0,
      partners: 0
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

module.exports = new ContactService();
