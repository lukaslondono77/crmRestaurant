const db = require('../config/database');
const { parsePaginationParams, formatPaginatedResponse } = require('../utils/pagination');

class KanbanService {
  /**
   * Get all boards for tenant
   */
  async getBoards(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    const alias = 'b';
    let whereConditions = [`${alias}.tenant_id = ?`];
    const params = [tenantId];

    if (filters.userId) {
      whereConditions.push(`${alias}.user_id = ?`);
      params.push(filters.userId);
    }

    if (filters.isArchived !== undefined) {
      whereConditions.push(`${alias}.is_archived = ?`);
      params.push(filters.isArchived ? 1 : 0);
    }

    if (filters.search) {
      whereConditions.push(`(${alias}.name LIKE ? OR ${alias}.description LIKE ?)`);
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM kanban_boards ${alias} ${whereClause}`, params);
    const total = countResult?.total || 0;

    const boards = await db.allAsync(`
      SELECT 
        b.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM kanban_boards b
      LEFT JOIN users u ON b.user_id = u.id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const parsedBoards = boards.map(board => ({
      ...board,
      is_archived: Boolean(board.is_archived)
    }));

    return formatPaginatedResponse(parsedBoards, total, page, limit);
  }

  /**
   * Get board with columns and cards
   */
  async getBoardById(tenantId, boardId) {
    const board = await db.getAsync(`
      SELECT 
        b.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM kanban_boards b
      LEFT JOIN users u ON b.user_id = u.id
      WHERE b.id = ? AND b.tenant_id = ?
    `, [boardId, tenantId]);

    if (!board) {
      throw new Error('Board not found');
    }

    // Get columns
    const columns = await db.allAsync(`
      SELECT * FROM kanban_columns
      WHERE board_id = ? AND tenant_id = ? AND is_archived = 0
      ORDER BY position ASC
    `, [boardId, tenantId]);

    // Get cards for each column
    for (const column of columns) {
      column.cards = await db.allAsync(`
        SELECT 
          c.*,
          u1.first_name || ' ' || u1.last_name as created_by_name,
          u2.first_name || ' ' || u2.last_name as assigned_to_name
        FROM kanban_cards c
        LEFT JOIN users u1 ON c.user_id = u1.id
        LEFT JOIN users u2 ON c.assigned_to = u2.id
        WHERE c.column_id = ? AND c.tenant_id = ? AND c.is_archived = 0
        ORDER BY c.position ASC
      `, [column.id, tenantId]);

      // Parse JSON fields
      column.cards = column.cards.map(card => ({
        ...card,
        is_archived: Boolean(card.is_archived),
        tags: card.tags ? (this._tryParseJSON(card.tags) || []) : []
      }));
    }

    return {
      ...board,
      is_archived: Boolean(board.is_archived),
      columns: columns.map(col => ({
        ...col,
        is_archived: Boolean(col.is_archived)
      }))
    };
  }

  /**
   * Create board
   */
  async createBoard(tenantId, userId, boardData) {
    const { name, description, color = '#3b82f6' } = boardData;

    if (!name) {
      throw new Error('Board name is required');
    }

    const result = await db.runAsync(`
      INSERT INTO kanban_boards (tenant_id, user_id, name, description, color)
      VALUES (?, ?, ?, ?, ?)
    `, [tenantId, userId, name, description || null, color]);

    const boardId = result.lastID;

    // Create default columns
    const defaultColumns = ['To Do', 'In Progress', 'Done'];
    for (let i = 0; i < defaultColumns.length; i++) {
      await db.runAsync(`
        INSERT INTO kanban_columns (tenant_id, board_id, name, position)
        VALUES (?, ?, ?, ?)
      `, [tenantId, boardId, defaultColumns[i], i]);
    }

    return this.getBoardById(tenantId, boardId);
  }

  /**
   * Update board
   */
  async updateBoard(tenantId, boardId, updateData) {
    const existing = await this.getBoardById(tenantId, boardId);

    const updates = [];
    const params = [];

    if (updateData.name !== undefined) {
      updates.push('name = ?');
      params.push(updateData.name);
    }

    if (updateData.description !== undefined) {
      updates.push('description = ?');
      params.push(updateData.description || null);
    }

    if (updateData.color !== undefined) {
      updates.push('color = ?');
      params.push(updateData.color);
    }

    if (updateData.isArchived !== undefined) {
      updates.push('is_archived = ?');
      params.push(updateData.isArchived ? 1 : 0);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(boardId, tenantId);

    await db.runAsync(`
      UPDATE kanban_boards
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return this.getBoardById(tenantId, boardId);
  }

  /**
   * Delete board
   */
  async deleteBoard(tenantId, boardId) {
    const existing = await this.getBoardById(tenantId, boardId);
    
    await db.runAsync('DELETE FROM kanban_boards WHERE id = ? AND tenant_id = ?', [boardId, tenantId]);
    return { success: true, deleted: existing };
  }

  /**
   * Create column
   */
  async createColumn(tenantId, boardId, columnData) {
    const { name, position, color } = columnData;

    if (!name) {
      throw new Error('Column name is required');
    }

    // Get max position if not provided
    let finalPosition = position;
    if (finalPosition === undefined) {
      const maxPos = await db.getAsync(`
        SELECT MAX(position) as max FROM kanban_columns
        WHERE board_id = ? AND tenant_id = ?
      `, [boardId, tenantId]);
      finalPosition = (maxPos?.max || -1) + 1;
    }

    const result = await db.runAsync(`
      INSERT INTO kanban_columns (tenant_id, board_id, name, position, color)
      VALUES (?, ?, ?, ?, ?)
    `, [tenantId, boardId, name, finalPosition, color || null]);

    return await db.getAsync('SELECT * FROM kanban_columns WHERE id = ?', [result.lastID]);
  }

  /**
   * Update column
   */
  async updateColumn(tenantId, columnId, updateData) {
    const updates = [];
    const params = [];

    if (updateData.name !== undefined) {
      updates.push('name = ?');
      params.push(updateData.name);
    }

    if (updateData.position !== undefined) {
      updates.push('position = ?');
      params.push(updateData.position);
    }

    if (updateData.color !== undefined) {
      updates.push('color = ?');
      params.push(updateData.color || null);
    }

    if (updateData.isArchived !== undefined) {
      updates.push('is_archived = ?');
      params.push(updateData.isArchived ? 1 : 0);
    }

    if (updates.length === 0) {
      return await db.getAsync('SELECT * FROM kanban_columns WHERE id = ?', [columnId]);
    }

    params.push(columnId, tenantId);
    await db.runAsync(`
      UPDATE kanban_columns
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return await db.getAsync('SELECT * FROM kanban_columns WHERE id = ?', [columnId]);
  }

  /**
   * Delete column
   */
  async deleteColumn(tenantId, columnId) {
    const existing = await db.getAsync('SELECT * FROM kanban_columns WHERE id = ? AND tenant_id = ?', [columnId, tenantId]);
    if (!existing) throw new Error('Column not found');

    await db.runAsync('DELETE FROM kanban_columns WHERE id = ? AND tenant_id = ?', [columnId, tenantId]);
    return { success: true, deleted: existing };
  }

  /**
   * Create card
   */
  async createCard(tenantId, boardId, columnId, userId, cardData) {
    const { title, description, position, priority = 'medium', dueDate, assignedTo, tags, color } = cardData;

    if (!title) {
      throw new Error('Card title is required');
    }

    // Get max position if not provided
    let finalPosition = position;
    if (finalPosition === undefined) {
      const maxPos = await db.getAsync(`
        SELECT MAX(position) as max FROM kanban_cards
        WHERE column_id = ? AND tenant_id = ?
      `, [columnId, tenantId]);
      finalPosition = (maxPos?.max || -1) + 1;
    }

    const result = await db.runAsync(`
      INSERT INTO kanban_cards (
        tenant_id, board_id, column_id, user_id, title, description,
        position, priority, due_date, assigned_to, tags, color
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, boardId, columnId, userId, title, description || null,
      finalPosition, priority, dueDate || null, assignedTo || null,
      tags ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : null,
      color || null
    ]);

    return await this.getCardById(tenantId, result.lastID);
  }

  /**
   * Get card by ID
   */
  async getCardById(tenantId, cardId) {
    const card = await db.getAsync(`
      SELECT 
        c.*,
        u1.first_name || ' ' || u1.last_name as created_by_name,
        u2.first_name || ' ' || u2.last_name as assigned_to_name
      FROM kanban_cards c
      LEFT JOIN users u1 ON c.user_id = u1.id
      LEFT JOIN users u2 ON c.assigned_to = u2.id
      WHERE c.id = ? AND c.tenant_id = ?
    `, [cardId, tenantId]);

    if (!card) {
      throw new Error('Card not found');
    }

    return {
      ...card,
      is_archived: Boolean(card.is_archived),
      tags: card.tags ? (this._tryParseJSON(card.tags) || []) : []
    };
  }

  /**
   * Update card
   */
  async updateCard(tenantId, cardId, updateData) {
    const existing = await this.getCardById(tenantId, cardId);

    const updates = [];
    const params = [];

    const fields = {
      title: 'title',
      description: 'description',
      position: 'position',
      priority: 'priority',
      dueDate: 'due_date',
      assignedTo: 'assigned_to',
      color: 'color',
      columnId: 'column_id'
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

    if (updateData.isArchived !== undefined) {
      updates.push('is_archived = ?');
      params.push(updateData.isArchived ? 1 : 0);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(cardId, tenantId);

    await db.runAsync(`
      UPDATE kanban_cards
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return this.getCardById(tenantId, cardId);
  }

  /**
   * Move card to different column
   */
  async moveCard(tenantId, cardId, newColumnId, newPosition) {
    const card = await this.getCardById(tenantId, cardId);
    
    await db.runAsync(`
      UPDATE kanban_cards
      SET column_id = ?, position = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `, [newColumnId, newPosition, cardId, tenantId]);

    return this.getCardById(tenantId, cardId);
  }

  /**
   * Delete card
   */
  async deleteCard(tenantId, cardId) {
    const existing = await this.getCardById(tenantId, cardId);
    
    await db.runAsync('DELETE FROM kanban_cards WHERE id = ? AND tenant_id = ?', [cardId, tenantId]);
    return { success: true, deleted: existing };
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

module.exports = new KanbanService();
