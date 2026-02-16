const db = require('../config/database');
const { parsePaginationParams, formatPaginatedResponse } = require('../utils/pagination');

class CalendarService {
  /**
   * Get all calendar events with filters
   */
  async getEvents(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    const alias = 'e';
    let whereConditions = [`${alias}.tenant_id = ?`];
    const params = [tenantId];

    // Filter by date range
    if (filters.startDate) {
      whereConditions.push(`${alias}.start_date >= ?`);
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereConditions.push(`${alias}.end_date <= ?`);
      params.push(filters.endDate);
    }

    // Filter by event type
    if (filters.eventType) {
      whereConditions.push(`${alias}.event_type = ?`);
      params.push(filters.eventType);
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

    // Filter by category
    if (filters.category) {
      whereConditions.push(`${alias}.category = ?`);
      params.push(filters.category);
    }

    // Filter all-day events
    if (filters.allDay !== undefined) {
      whereConditions.push(`${alias}.all_day = ?`);
      params.push(filters.allDay ? 1 : 0);
    }

    // Search by title or description
    if (filters.search) {
      whereConditions.push(`(${alias}.title LIKE ? OR ${alias}.description LIKE ?)`);
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM calendar_events ${alias} ${whereClause}`;
    const countResult = await db.getAsync(countQuery, params);
    const total = countResult?.total || 0;

    // Get events
    const orderBy = filters.orderBy || 'e.start_date ASC';
    const eventsQuery = `
      SELECT 
        e.*,
        u.first_name || ' ' || u.last_name as created_by_name,
        u.email as created_by_email
      FROM calendar_events e
      LEFT JOIN users u ON e.user_id = u.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;
    
    const events = await db.allAsync(eventsQuery, [...params, limit, offset]);

    // Parse JSON fields
    const parsedEvents = events.map(event => ({
      ...event,
      all_day: Boolean(event.all_day),
      attendees: event.attendees ? (this._tryParseJSON(event.attendees) || []) : [],
      tags: event.tags ? (this._tryParseJSON(event.tags) || []) : []
    }));

    return formatPaginatedResponse(parsedEvents, total, page, limit);
  }

  /**
   * Get events for a specific date range (for calendar view)
   */
  async getEventsByDateRange(tenantId, startDate, endDate, filters = {}) {
    let whereConditions = [
      'tenant_id = ?',
      'start_date >= ?',
      'end_date <= ?'
    ];
    const params = [tenantId, startDate, endDate];

    // Filter by event type
    if (filters.eventType) {
      whereConditions.push('event_type = ?');
      params.push(filters.eventType);
    }

    // Filter by status
    if (filters.status) {
      whereConditions.push('status = ?');
      params.push(filters.status);
    }

    // Filter by user
    if (filters.userId) {
      whereConditions.push('user_id = ?');
      params.push(filters.userId);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const events = await db.allAsync(`
      SELECT 
        e.*,
        u.first_name || ' ' || u.last_name as created_by_name,
        u.email as created_by_email
      FROM calendar_events e
      LEFT JOIN users u ON e.user_id = u.id
      ${whereClause}
      ORDER BY start_date ASC
    `, params);

    // Parse JSON fields
    return events.map(event => ({
      ...event,
      all_day: Boolean(event.all_day),
      attendees: event.attendees ? (this._tryParseJSON(event.attendees) || []) : [],
      tags: event.tags ? (this._tryParseJSON(event.tags) || []) : []
    }));
  }

  /**
   * Get single event by ID
   */
  async getEventById(tenantId, eventId) {
    const event = await db.getAsync(`
      SELECT 
        e.*,
        u.first_name || ' ' || u.last_name as created_by_name,
        u.email as created_by_email
      FROM calendar_events e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.id = ? AND e.tenant_id = ?
    `, [eventId, tenantId]);

    if (!event) {
      throw new Error('Event not found');
    }

    return {
      ...event,
      all_day: Boolean(event.all_day),
      attendees: event.attendees ? (this._tryParseJSON(event.attendees) || []) : [],
      tags: event.tags ? (this._tryParseJSON(event.tags) || []) : []
    };
  }

  /**
   * Create new event
   */
  async createEvent(tenantId, userId, eventData) {
    const {
      title,
      description,
      startDate,
      endDate,
      allDay = false,
      location,
      eventType = 'event',
      status = 'scheduled',
      color = '#3b82f6',
      attendees,
      reminderMinutes,
      recurrenceRule,
      parentEventId,
      category,
      tags
    } = eventData;

    if (!title || !startDate || !endDate) {
      throw new Error('Title, start date, and end date are required');
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      throw new Error('Start date must be before end date');
    }

    // Validate event type
    const validEventTypes = ['event', 'appointment', 'meeting', 'reminder', 'holiday'];
    if (!validEventTypes.includes(eventType)) {
      throw new Error(`Invalid event type. Must be one of: ${validEventTypes.join(', ')}`);
    }

    // Validate status
    const validStatuses = ['scheduled', 'confirmed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const result = await db.runAsync(`
      INSERT INTO calendar_events (
        tenant_id, user_id, title, description, start_date, end_date,
        all_day, location, event_type, status, color, attendees,
        reminder_minutes, recurrence_rule, parent_event_id, category, tags
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId,
      userId,
      title,
      description || null,
      startDate,
      endDate,
      allDay ? 1 : 0,
      location || null,
      eventType,
      status,
      color,
      attendees ? (Array.isArray(attendees) ? JSON.stringify(attendees) : attendees) : null,
      reminderMinutes || null,
      recurrenceRule || null,
      parentEventId || null,
      category || null,
      tags ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : null
    ]);

    return this.getEventById(tenantId, result.lastID);
  }

  /**
   * Update event
   */
  async updateEvent(tenantId, eventId, updateData) {
    // Verify event exists and belongs to tenant
    const existing = await this.getEventById(tenantId, eventId);

    const {
      title,
      description,
      startDate,
      endDate,
      allDay,
      location,
      eventType,
      status,
      color,
      attendees,
      reminderMinutes,
      recurrenceRule,
      category,
      tags
    } = updateData;

    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }

    if (startDate !== undefined) {
      updates.push('start_date = ?');
      params.push(startDate);
    }

    if (endDate !== undefined) {
      updates.push('end_date = ?');
      params.push(endDate);
      
      // Validate dates if both are being updated
      if (startDate !== undefined || existing.start_date) {
        const start = new Date(startDate || existing.start_date);
        const end = new Date(endDate);
        if (start > end) {
          throw new Error('Start date must be before end date');
        }
      }
    }

    if (allDay !== undefined) {
      updates.push('all_day = ?');
      params.push(allDay ? 1 : 0);
    }

    if (location !== undefined) {
      updates.push('location = ?');
      params.push(location || null);
    }

    if (eventType !== undefined) {
      const validEventTypes = ['event', 'appointment', 'meeting', 'reminder', 'holiday'];
      if (!validEventTypes.includes(eventType)) {
        throw new Error(`Invalid event type. Must be one of: ${validEventTypes.join(', ')}`);
      }
      updates.push('event_type = ?');
      params.push(eventType);
    }

    if (status !== undefined) {
      const validStatuses = ['scheduled', 'confirmed', 'cancelled', 'completed'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
      updates.push('status = ?');
      params.push(status);
    }

    if (color !== undefined) {
      updates.push('color = ?');
      params.push(color);
    }

    if (attendees !== undefined) {
      updates.push('attendees = ?');
      params.push(attendees ? (Array.isArray(attendees) ? JSON.stringify(attendees) : attendees) : null);
    }

    if (reminderMinutes !== undefined) {
      updates.push('reminder_minutes = ?');
      params.push(reminderMinutes || null);
    }

    if (recurrenceRule !== undefined) {
      updates.push('recurrence_rule = ?');
      params.push(recurrenceRule || null);
    }

    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category || null);
    }

    if (tags !== undefined) {
      updates.push('tags = ?');
      params.push(tags ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : null);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(eventId, tenantId);

    await db.runAsync(`
      UPDATE calendar_events
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
    
    await db.runAsync(`
      DELETE FROM calendar_events
      WHERE id = ? AND tenant_id = ?
    `, [eventId, tenantId]);

    return { success: true, deleted: existing };
  }

  /**
   * Get upcoming events
   */
  async getUpcomingEvents(tenantId, limit = 10, filters = {}) {
    let whereConditions = [
      'tenant_id = ?',
      'start_date >= datetime("now")',
      'status != "cancelled"'
    ];
    const params = [tenantId];

    if (filters.userId) {
      whereConditions.push('user_id = ?');
      params.push(filters.userId);
    }

    if (filters.eventType) {
      whereConditions.push('event_type = ?');
      params.push(filters.eventType);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const events = await db.allAsync(`
      SELECT 
        e.*,
        u.first_name || ' ' || u.last_name as created_by_name,
        u.email as created_by_email
      FROM calendar_events e
      LEFT JOIN users u ON e.user_id = u.id
      ${whereClause}
      ORDER BY start_date ASC
      LIMIT ?
    `, [...params, limit]);

    return events.map(event => ({
      ...event,
      all_day: Boolean(event.all_day),
      attendees: event.attendees ? (this._tryParseJSON(event.attendees) || []) : [],
      tags: event.tags ? (this._tryParseJSON(event.tags) || []) : []
    }));
  }

  /**
   * Get events statistics
   */
  async getEventStats(tenantId, filters = {}) {
    let whereConditions = ['tenant_id = ?'];
    const params = [tenantId];

    if (filters.userId) {
      whereConditions.push('user_id = ?');
      params.push(filters.userId);
    }

    if (filters.startDate) {
      whereConditions.push('start_date >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereConditions.push('end_date <= ?');
      params.push(filters.endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const stats = await db.getAsync(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN event_type = 'event' THEN 1 ELSE 0 END) as events,
        SUM(CASE WHEN event_type = 'appointment' THEN 1 ELSE 0 END) as appointments,
        SUM(CASE WHEN event_type = 'meeting' THEN 1 ELSE 0 END) as meetings,
        SUM(CASE WHEN event_type = 'reminder' THEN 1 ELSE 0 END) as reminders,
        SUM(CASE WHEN event_type = 'holiday' THEN 1 ELSE 0 END) as holidays,
        SUM(CASE WHEN start_date >= datetime('now') AND start_date <= datetime('now', '+7 days') THEN 1 ELSE 0 END) as upcoming_week
      FROM calendar_events
      ${whereClause}
    `, params);

    return stats || {
      total: 0,
      scheduled: 0,
      confirmed: 0,
      cancelled: 0,
      completed: 0,
      events: 0,
      appointments: 0,
      meetings: 0,
      reminders: 0,
      holidays: 0,
      upcoming_week: 0
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

module.exports = new CalendarService();
