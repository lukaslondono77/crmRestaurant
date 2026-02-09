const db = require('../config/database');
const { parsePaginationParams, formatPaginatedResponse } = require('../utils/pagination');

const PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent'
};

const STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

function normalizePriority(value) {
  if (!value) return undefined;
  const key = String(value).trim().toLowerCase();
  return PRIORITY_LABELS[key] ? key : undefined;
}

function normalizeStatus(value) {
  if (!value) return undefined;
  const raw = String(value).trim();
  const key = raw.toLowerCase().replace(/\s+/g, '_');
  if (key === 'not_started') return 'pending';
  if (STATUS_LABELS[key]) return key;
  return undefined;
}

function toPriorityLabel(value) {
  if (!value) return 'Medium';
  const key = String(value).trim().toLowerCase();
  return PRIORITY_LABELS[key] || value;
}

function toStatusLabel(value) {
  if (!value) return 'Pending';
  const key = String(value).trim().toLowerCase();
  return STATUS_LABELS[key] || value;
}

class TodoService {
  /**
   * Get all todos with filters and pagination
   */
  async getTodos(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    const alias = 't';
    let whereConditions = [`${alias}.tenant_id = ?`];
    const params = [tenantId];

    // Filter by status
    if (filters.status) {
      whereConditions.push(`${alias}.status = ?`);
      params.push(filters.status);
    }

    // Filter by priority
    if (filters.priority) {
      whereConditions.push(`${alias}.priority = ?`);
      params.push(filters.priority);
    }

    // Filter by assigned_to
    if (filters.assignedTo) {
      whereConditions.push(`${alias}.assigned_to = ?`);
      params.push(filters.assignedTo);
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

    // Filter by due date range
    if (filters.dueDateFrom) {
      whereConditions.push(`${alias}.due_date >= ?`);
      params.push(filters.dueDateFrom);
    }

    if (filters.dueDateTo) {
      whereConditions.push(`${alias}.due_date <= ?`);
      params.push(filters.dueDateTo);
    }

    // Filter overdue tasks
    if (filters.overdue === 'true') {
      whereConditions.push(`${alias}.due_date < date("now") AND ${alias}.status != "completed"`);
    }

    // Search by task name or description
    if (filters.search) {
      whereConditions.push(`(${alias}.task_name LIKE ? OR ${alias}.description LIKE ?)`);
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM todos ${alias} ${whereClause}`;
    const countResult = await db.getAsync(countQuery, params);
    const total = countResult?.total || 0;

    // Get todos
    const orderBy = filters.orderBy || 't.created_at DESC';
    const todosQuery = `
      SELECT 
        t.*,
        u1.first_name || ' ' || u1.last_name as created_by_name,
        u1.email as created_by_email,
        COALESCE(t.assigned_to_name, u2.first_name || ' ' || u2.last_name) as assigned_to_name,
        u2.email as assigned_to_email
      FROM todos t
      LEFT JOIN users u1 ON t.user_id = u1.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;
    
    const todos = await db.allAsync(todosQuery, [...params, limit, offset]);
    const formattedTodos = todos.map(todo => ({
      ...todo,
      priority_label: toPriorityLabel(todo.priority),
      status_label: toStatusLabel(todo.status)
    }));

    return formatPaginatedResponse(formattedTodos, total, page, limit);
  }

  /**
   * Get single todo by ID
   */
  async getTodoById(tenantId, todoId) {
    const todo = await db.getAsync(`
      SELECT 
        t.*,
        u1.first_name || ' ' || u1.last_name as created_by_name,
        u1.email as created_by_email,
        COALESCE(t.assigned_to_name, u2.first_name || ' ' || u2.last_name) as assigned_to_name,
        u2.email as assigned_to_email
      FROM todos t
      LEFT JOIN users u1 ON t.user_id = u1.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      WHERE t.id = ? AND t.tenant_id = ?
    `, [todoId, tenantId]);

    if (!todo) {
      throw new Error('Todo not found');
    }

    return {
      ...todo,
      priority_label: toPriorityLabel(todo.priority),
      status_label: toStatusLabel(todo.status)
    };
  }

  /**
   * Create new todo
   */
  async createTodo(tenantId, userId, todoData) {
    const taskName = todoData.taskName ?? todoData.task_name;
    const description = todoData.description;
    const rawPriority = todoData.priority ?? todoData.priority_label;
    const rawStatus = todoData.status ?? todoData.status_label;
    const dueDate = todoData.dueDate ?? todoData.due_date;
    const assignedTo = todoData.assignedTo ?? todoData.assigned_to;
    const assignedToName = todoData.assignedToName ?? todoData.assigned_to_name;
    const category = todoData.category;
    const tags = todoData.tags;
    const taskIdInput = todoData.taskId ?? todoData.task_id;

    if (!taskName) {
      throw new Error('Task name is required');
    }

    // Validate priority
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    const priority = normalizePriority(rawPriority) || 'medium';
    if (!validPriorities.includes(priority)) {
      throw new Error(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
    }

    // Validate status
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    const status = normalizeStatus(rawStatus) || 'pending';
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    let assignedToValue = assignedTo || null;
    let assignedToNameValue = assignedToName || null;
    if (assignedToValue && typeof assignedToValue === 'string' && Number.isNaN(Number(assignedToValue))) {
      assignedToNameValue = assignedToNameValue || assignedToValue;
      assignedToValue = null;
    }

    let taskIdValue = taskIdInput;
    if (!taskIdValue) {
      taskIdValue = `#${Math.floor(100 + Math.random() * 900)}`;
    }
    if (!String(taskIdValue).startsWith('#')) {
      taskIdValue = `#${taskIdValue}`;
    }

    const result = await db.runAsync(`
      INSERT INTO todos (
        tenant_id, user_id, task_id, task_name, description, priority, status,
        due_date, assigned_to, assigned_to_name, category, tags
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId,
      userId,
      taskIdValue,
      taskName,
      description || null,
      priority,
      status,
      dueDate || null,
      assignedToValue,
      assignedToNameValue,
      category || null,
      tags ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : null
    ]);

    return this.getTodoById(tenantId, result.lastID);
  }

  /**
   * Update todo
   */
  async updateTodo(tenantId, todoId, updateData) {
    // Verify todo exists and belongs to tenant
    const existing = await this.getTodoById(tenantId, todoId);

    const taskName = updateData.taskName ?? updateData.task_name;
    const description = updateData.description;
    const rawPriority = updateData.priority ?? updateData.priority_label;
    const rawStatus = updateData.status ?? updateData.status_label;
    const dueDate = updateData.dueDate ?? updateData.due_date;
    const assignedTo = updateData.assignedTo ?? updateData.assigned_to;
    const assignedToName = updateData.assignedToName ?? updateData.assigned_to_name;
    const category = updateData.category;
    const tags = updateData.tags;
    const taskIdInput = updateData.taskId ?? updateData.task_id;

    const updates = [];
    const params = [];

    if (taskName !== undefined) {
      updates.push('task_name = ?');
      params.push(taskName);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }

    if (rawPriority !== undefined) {
      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      const priority = normalizePriority(rawPriority);
      if (!validPriorities.includes(priority)) {
        throw new Error(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
      }
      updates.push('priority = ?');
      params.push(priority);
    }

    if (rawStatus !== undefined) {
      const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
      const status = normalizeStatus(rawStatus);
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
      updates.push('status = ?');
      params.push(status);

      // Set completed_at if status is completed
      if (status === 'completed' && existing.status !== 'completed') {
        updates.push('completed_at = CURRENT_TIMESTAMP');
      } else if (status !== 'completed' && existing.status === 'completed') {
        updates.push('completed_at = NULL');
      }
    }

    if (dueDate !== undefined) {
      updates.push('due_date = ?');
      params.push(dueDate || null);
    }

    if (assignedTo !== undefined) {
      let assignedToValue = assignedTo || null;
      let assignedToNameValue = assignedToName || null;
      if (assignedToValue && typeof assignedToValue === 'string' && Number.isNaN(Number(assignedToValue))) {
        assignedToNameValue = assignedToNameValue || assignedToValue;
        assignedToValue = null;
      }
      updates.push('assigned_to = ?');
      params.push(assignedToValue);
      if (assignedToNameValue !== undefined) {
        updates.push('assigned_to_name = ?');
        params.push(assignedToNameValue);
      }
    } else if (assignedToName !== undefined) {
      updates.push('assigned_to_name = ?');
      params.push(assignedToName || null);
    }

    if (taskIdInput !== undefined) {
      let taskIdValue = taskIdInput;
      if (taskIdValue && !String(taskIdValue).startsWith('#')) {
        taskIdValue = `#${taskIdValue}`;
      }
      updates.push('task_id = ?');
      params.push(taskIdValue || null);
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
    params.push(todoId, tenantId);

    await db.runAsync(`
      UPDATE todos
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return this.getTodoById(tenantId, todoId);
  }

  /**
   * Delete todo
   */
  async deleteTodo(tenantId, todoId) {
    const existing = await this.getTodoById(tenantId, todoId);
    
    await db.runAsync(`
      DELETE FROM todos
      WHERE id = ? AND tenant_id = ?
    `, [todoId, tenantId]);

    return { success: true, deleted: existing };
  }

  /**
   * Get todo statistics
   */
  async getTodoStats(tenantId, filters = {}) {
    let whereConditions = ['tenant_id = ?'];
    const params = [tenantId];

    // Filter by user
    if (filters.userId) {
      whereConditions.push('user_id = ?');
      params.push(filters.userId);
    }

    // Filter by assigned_to
    if (filters.assignedTo) {
      whereConditions.push('assigned_to = ?');
      params.push(filters.assignedTo);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const stats = await db.getAsync(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent,
        SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN priority = 'medium' THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN priority = 'low' THEN 1 ELSE 0 END) as low,
        SUM(CASE WHEN due_date < date('now') AND status != 'completed' THEN 1 ELSE 0 END) as overdue
      FROM todos
      ${whereClause}
    `, params);

    return stats || {
      total: 0,
      pending: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
      overdue: 0
    };
  }
}

module.exports = new TodoService();
