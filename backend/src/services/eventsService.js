const db = require('../config/database');
const { parsePaginationParams, formatPaginatedResponse } = require('../utils/pagination');

class EventsService {
  /**
   * Get all events
   */
  async getEvents(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['e.tenant_id = ?'];
    const params = [tenantId];

    if (filters.status) {
      whereConditions.push('e.status = ?');
      params.push(filters.status);
    }

    if (filters.eventType) {
      whereConditions.push('e.event_type = ?');
      params.push(filters.eventType);
    }

    if (filters.startDate) {
      whereConditions.push('e.start_date >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereConditions.push('e.end_date <= ?');
      params.push(filters.endDate);
    }

    if (filters.search) {
      whereConditions.push('(e.title LIKE ? OR e.description LIKE ? OR e.location LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM events e ${whereClause}`, params);
    const total = countResult?.total || 0;

    const events = await db.allAsync(`
      SELECT 
        e.*,
        u.first_name || ' ' || u.last_name as created_by_name,
        (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id) as registration_count
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
      ${whereClause}
      ORDER BY e.start_date ASC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const parsedEvents = events.map(event => ({
      ...event,
      is_online: Boolean(event.is_online),
      registration_required: Boolean(event.registration_required),
      tags: event.tags ? (this._tryParseJSON(event.tags) || []) : []
    }));

    return formatPaginatedResponse(parsedEvents, total, page, limit);
  }

  /**
   * Get event by ID with details
   */
  async getEventById(tenantId, eventId) {
    const event = await db.getAsync(`
      SELECT 
        e.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.id = ? AND e.tenant_id = ?
    `, [eventId, tenantId]);

    if (!event) {
      throw new Error('Event not found');
    }

    // Get speakers
    event.speakers = await db.allAsync(`
      SELECT * FROM event_speakers
      WHERE event_id = ? AND tenant_id = ?
      ORDER BY order_index ASC
    `, [eventId, tenantId]);

    event.speakers = event.speakers.map(speaker => ({
      ...speaker,
      social_links: speaker.social_links ? (this._tryParseJSON(speaker.social_links) || {}) : {}
    }));

    // Get sessions
    event.sessions = await db.allAsync(`
      SELECT 
        s.*,
        sp.name as speaker_name
      FROM event_sessions s
      LEFT JOIN event_speakers sp ON s.speaker_id = sp.id
      WHERE s.event_id = ? AND s.tenant_id = ?
      ORDER BY s.order_index ASC, s.start_time ASC
    `, [eventId, tenantId]);

    // Get registration count
    const regCount = await db.getAsync(`
      SELECT COUNT(*) as count FROM event_registrations
      WHERE event_id = ? AND tenant_id = ?
    `, [eventId, tenantId]);
    event.registration_count = regCount?.count || 0;

    return {
      ...event,
      is_online: Boolean(event.is_online),
      registration_required: Boolean(event.registration_required),
      tags: event.tags ? (this._tryParseJSON(event.tags) || []) : []
    };
  }

  /**
   * Create event
   */
  async createEvent(tenantId, userId, eventData) {
    const {
      title, description, eventType = 'event', startDate, endDate,
      location, venueName, venueAddress, isOnline = false, onlineUrl,
      capacity, price = 0, currency = 'USD', imageUrl, status = 'draft',
      registrationRequired = false, registrationDeadline, tags
    } = eventData;

    if (!title || !startDate || !endDate) {
      throw new Error('Event title, start date, and end date are required');
    }

    const result = await db.runAsync(`
      INSERT INTO events (
        tenant_id, created_by, title, description, event_type, start_date, end_date,
        location, venue_name, venue_address, is_online, online_url, capacity,
        price, currency, image_url, status, registration_required, registration_deadline, tags
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, userId, title, description || null, eventType, startDate, endDate,
      location || null, venueName || null, venueAddress || null, isOnline ? 1 : 0,
      onlineUrl || null, capacity || null, price, currency, imageUrl || null,
      status, registrationRequired ? 1 : 0, registrationDeadline || null,
      tags ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : null
    ]);

    return this.getEventById(tenantId, result.lastID);
  }

  /**
   * Update event
   */
  async updateEvent(tenantId, eventId, updateData) {
    const existing = await this.getEventById(tenantId, eventId);

    const updates = [];
    const params = [];

    const fields = {
      title: 'title',
      description: 'description',
      eventType: 'event_type',
      startDate: 'start_date',
      endDate: 'end_date',
      location: 'location',
      venueName: 'venue_name',
      venueAddress: 'venue_address',
      onlineUrl: 'online_url',
      capacity: 'capacity',
      price: 'price',
      currency: 'currency',
      imageUrl: 'image_url',
      status: 'status',
      registrationDeadline: 'registration_deadline'
    };

    Object.keys(fields).forEach(key => {
      if (updateData[key] !== undefined) {
        updates.push(`${fields[key]} = ?`);
        params.push(updateData[key] || null);
      }
    });

    if (updateData.isOnline !== undefined) {
      updates.push('is_online = ?');
      params.push(updateData.isOnline ? 1 : 0);
    }

    if (updateData.registrationRequired !== undefined) {
      updates.push('registration_required = ?');
      params.push(updateData.registrationRequired ? 1 : 0);
    }

    if (updateData.tags !== undefined) {
      updates.push('tags = ?');
      params.push(updateData.tags ? (Array.isArray(updateData.tags) ? JSON.stringify(updateData.tags) : updateData.tags) : null);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(eventId, tenantId);

    await db.runAsync(`
      UPDATE events
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return this.getEventById(tenantId, eventId);
  }

  /**
   * Delete event
   */
  async deleteEvent(tenantId, eventId) {
    const existing = await this.getEventById(tenantId, eventId);
    await db.runAsync('DELETE FROM events WHERE id = ? AND tenant_id = ?', [eventId, tenantId]);
    return { success: true, deleted: existing };
  }

  /**
   * Register for event
   */
  async registerForEvent(tenantId, eventId, registrationData) {
    const {
      userId, firstName, lastName, email, phone, company, jobTitle, notes
    } = registrationData;

    if (!firstName || !lastName || !email) {
      throw new Error('First name, last name, and email are required');
    }

    // Check event capacity
    const event = await this.getEventById(tenantId, eventId);
    if (event.capacity && event.registration_count >= event.capacity) {
      throw new Error('Event is at full capacity');
    }

    // Check if already registered
    const existing = await db.getAsync(`
      SELECT * FROM event_registrations
      WHERE event_id = ? AND email = ? AND tenant_id = ?
    `, [eventId, email, tenantId]);

    if (existing) {
      throw new Error('Already registered for this event');
    }

    const paymentAmount = event.price || 0;

    const result = await db.runAsync(`
      INSERT INTO event_registrations (
        tenant_id, event_id, user_id, first_name, last_name, email,
        phone, company, job_title, payment_amount, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, eventId, userId || null, firstName, lastName, email,
      phone || null, company || null, jobTitle || null, paymentAmount, notes || null
    ]);

    return await db.getAsync('SELECT * FROM event_registrations WHERE id = ?', [result.lastID]);
  }

  /**
   * Get registrations for event
   */
  async getEventRegistrations(tenantId, eventId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['r.tenant_id = ?', 'r.event_id = ?'];
    const params = [tenantId, eventId];

    if (filters.status) {
      whereConditions.push('r.status = ?');
      params.push(filters.status);
    }

    if (filters.paymentStatus) {
      whereConditions.push('r.payment_status = ?');
      params.push(filters.paymentStatus);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM event_registrations r ${whereClause}`, params);
    const total = countResult?.total || 0;

    const registrations = await db.allAsync(`
      SELECT 
        r.*,
        u.first_name || ' ' || u.last_name as user_name
      FROM event_registrations r
      LEFT JOIN users u ON r.user_id = u.id
      ${whereClause}
      ORDER BY r.registration_date DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return formatPaginatedResponse(registrations, total, page, limit);
  }

  /**
   * Add speaker to event
   */
  async addSpeaker(tenantId, eventId, speakerData) {
    const {
      name, title, bio, company, imageUrl, socialLinks, orderIndex
    } = speakerData;

    if (!name) {
      throw new Error('Speaker name is required');
    }

    // Get max order_index if not provided
    let finalOrderIndex = orderIndex;
    if (finalOrderIndex === undefined) {
      const maxOrder = await db.getAsync(`
        SELECT MAX(order_index) as max FROM event_speakers
        WHERE event_id = ? AND tenant_id = ?
      `, [eventId, tenantId]);
      finalOrderIndex = (maxOrder?.max || -1) + 1;
    }

    const result = await db.runAsync(`
      INSERT INTO event_speakers (
        tenant_id, event_id, name, title, bio, company, image_url, social_links, order_index
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, eventId, name, title || null, bio || null, company || null,
      imageUrl || null,
      socialLinks ? (typeof socialLinks === 'object' ? JSON.stringify(socialLinks) : socialLinks) : null,
      finalOrderIndex
    ]);

    return await db.getAsync('SELECT * FROM event_speakers WHERE id = ?', [result.lastID]);
  }

  /**
   * Add session to event
   */
  async addSession(tenantId, eventId, sessionData) {
    const {
      title, description, startTime, endTime, location, speakerId, capacity, orderIndex
    } = sessionData;

    if (!title || !startTime || !endTime) {
      throw new Error('Session title, start time, and end time are required');
    }

    // Get max order_index if not provided
    let finalOrderIndex = orderIndex;
    if (finalOrderIndex === undefined) {
      const maxOrder = await db.getAsync(`
        SELECT MAX(order_index) as max FROM event_sessions
        WHERE event_id = ? AND tenant_id = ?
      `, [eventId, tenantId]);
      finalOrderIndex = (maxOrder?.max || -1) + 1;
    }

    const result = await db.runAsync(`
      INSERT INTO event_sessions (
        tenant_id, event_id, title, description, start_time, end_time,
        location, speaker_id, capacity, order_index
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, eventId, title, description || null, startTime, endTime,
      location || null, speakerId || null, capacity || null, finalOrderIndex
    ]);

    return await db.getAsync(`
      SELECT 
        s.*,
        sp.name as speaker_name
      FROM event_sessions s
      LEFT JOIN event_speakers sp ON s.speaker_id = sp.id
      WHERE s.id = ?
    `, [result.lastID]);
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

module.exports = new EventsService();
