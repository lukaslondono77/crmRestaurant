const db = require('../config/database');
const { parsePaginationParams, formatPaginatedResponse } = require('../utils/pagination');

class ProjectManagementService {
  /**
   * Get all projects
   */
  async getProjects(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['p.tenant_id = ?'];
    const params = [tenantId];

    if (filters.userId) {
      whereConditions.push('p.user_id = ?');
      params.push(filters.userId);
    }

    if (filters.status) {
      whereConditions.push('p.status = ?');
      params.push(filters.status);
    }

    if (filters.search) {
      whereConditions.push('(p.name LIKE ? OR p.description LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM projects p ${whereClause}`, params);
    const total = countResult?.total || 0;

    const projects = await db.allAsync(`
      SELECT 
        p.*,
        u.first_name || ' ' || u.last_name as owner_name,
        (SELECT COUNT(*) FROM project_tasks WHERE project_id = p.id AND status != 'done') as pending_tasks,
        (SELECT COUNT(*) FROM project_tasks WHERE project_id = p.id AND status = 'done') as completed_tasks
      FROM projects p
      LEFT JOIN users u ON p.user_id = u.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const parsedProjects = projects.map(project => ({
      ...project,
      tags: project.tags ? (this._tryParseJSON(project.tags) || []) : []
    }));

    return formatPaginatedResponse(parsedProjects, total, page, limit);
  }

  /**
   * Get project by ID with tasks and team
   */
  async getProjectById(tenantId, projectId) {
    const project = await db.getAsync(`
      SELECT 
        p.*,
        u.first_name || ' ' || u.last_name as owner_name
      FROM projects p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = ? AND p.tenant_id = ?
    `, [projectId, tenantId]);

    if (!project) {
      throw new Error('Project not found');
    }

    // Get tasks
    project.tasks = await db.allAsync(`
      SELECT 
        t.*,
        u1.first_name || ' ' || u1.last_name as created_by_name,
        u2.first_name || ' ' || u2.last_name as assigned_to_name
      FROM project_tasks t
      LEFT JOIN users u1 ON t.user_id = u1.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      WHERE t.project_id = ? AND t.tenant_id = ?
      ORDER BY t.position ASC, t.created_at ASC
    `, [projectId, tenantId]);

    project.tasks = project.tasks.map(task => ({
      ...task,
      tags: task.tags ? (this._tryParseJSON(task.tags) || []) : []
    }));

    // Get team members
    project.team = await db.allAsync(`
      SELECT 
        tm.*,
        u.first_name || ' ' || u.last_name as member_name,
        u.email as member_email
      FROM project_team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.project_id = ? AND tm.tenant_id = ?
    `, [projectId, tenantId]);

    return {
      ...project,
      tags: project.tags ? (this._tryParseJSON(project.tags) || []) : []
    };
  }

  /**
   * Create project
   */
  async createProject(tenantId, userId, projectData) {
    const {
      name, description, status = 'planning', priority = 'medium',
      startDate, endDate, budget, color = '#3b82f6', tags
    } = projectData;

    if (!name) {
      throw new Error('Project name is required');
    }

    const result = await db.runAsync(`
      INSERT INTO projects (
        tenant_id, user_id, name, description, status, priority,
        start_date, end_date, budget, color, tags
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, userId, name, description || null, status, priority,
      startDate || null, endDate || null, budget || null, color,
      tags ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : null
    ]);

    const projectId = result.lastID;

    // Add creator as team member with owner role
    await db.runAsync(`
      INSERT INTO project_team_members (tenant_id, project_id, user_id, role)
      VALUES (?, ?, ?, 'owner')
    `, [tenantId, projectId, userId]);

    return this.getProjectById(tenantId, projectId);
  }

  /**
   * Update project
   */
  async updateProject(tenantId, projectId, updateData) {
    const existing = await this.getProjectById(tenantId, projectId);

    const updates = [];
    const params = [];

    const fields = {
      name: 'name',
      description: 'description',
      status: 'status',
      priority: 'priority',
      startDate: 'start_date',
      endDate: 'end_date',
      budget: 'budget',
      spent: 'spent',
      progress: 'progress',
      color: 'color'
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
    params.push(projectId, tenantId);

    await db.runAsync(`
      UPDATE projects
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return this.getProjectById(tenantId, projectId);
  }

  /**
   * Delete project
   */
  async deleteProject(tenantId, projectId) {
    const existing = await this.getProjectById(tenantId, projectId);
    await db.runAsync('DELETE FROM projects WHERE id = ? AND tenant_id = ?', [projectId, tenantId]);
    return { success: true, deleted: existing };
  }

  /**
   * Get tasks for project
   */
  async getTasks(tenantId, projectId, filters = {}) {
    let whereConditions = ['t.tenant_id = ?', 't.project_id = ?'];
    const params = [tenantId, projectId];

    if (filters.status) {
      whereConditions.push('t.status = ?');
      params.push(filters.status);
    }

    if (filters.assignedTo) {
      whereConditions.push('t.assigned_to = ?');
      params.push(filters.assignedTo);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const tasks = await db.allAsync(`
      SELECT 
        t.*,
        u1.first_name || ' ' || u1.last_name as created_by_name,
        u2.first_name || ' ' || u2.last_name as assigned_to_name
      FROM project_tasks t
      LEFT JOIN users u1 ON t.user_id = u1.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      ${whereClause}
      ORDER BY t.position ASC, t.created_at ASC
    `, params);

    return tasks.map(task => ({
      ...task,
      tags: task.tags ? (this._tryParseJSON(task.tags) || []) : []
    }));
  }

  /**
   * Create task
   */
  async createTask(tenantId, projectId, userId, taskData) {
    const {
      title, description, status = 'todo', priority = 'medium',
      assignedTo, dueDate, estimatedHours, parentTaskId, tags
    } = taskData;

    if (!title) {
      throw new Error('Task title is required');
    }

    // Get max position
    const maxPos = await db.getAsync(`
      SELECT MAX(position) as max FROM project_tasks
      WHERE project_id = ? AND tenant_id = ?
    `, [projectId, tenantId]);
    const position = (maxPos?.max || -1) + 1;

    const result = await db.runAsync(`
      INSERT INTO project_tasks (
        tenant_id, project_id, user_id, title, description, status, priority,
        assigned_to, due_date, estimated_hours, parent_task_id, position, tags
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, projectId, userId, title, description || null, status, priority,
      assignedTo || null, dueDate || null, estimatedHours || null,
      parentTaskId || null, position,
      tags ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : null
    ]);

    return await db.getAsync(`
      SELECT 
        t.*,
        u1.first_name || ' ' || u1.last_name as created_by_name,
        u2.first_name || ' ' || u2.last_name as assigned_to_name
      FROM project_tasks t
      LEFT JOIN users u1 ON t.user_id = u1.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      WHERE t.id = ?
    `, [result.lastID]);
  }

  /**
   * Update task
   */
  async updateTask(tenantId, taskId, updateData) {
    const updates = [];
    const params = [];

    const fields = {
      title: 'title',
      description: 'description',
      status: 'status',
      priority: 'priority',
      assignedTo: 'assigned_to',
      dueDate: 'due_date',
      estimatedHours: 'estimated_hours',
      actualHours: 'actual_hours',
      position: 'position',
      parentTaskId: 'parent_task_id'
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
      return await db.getAsync('SELECT * FROM project_tasks WHERE id = ? AND tenant_id = ?', [taskId, tenantId]);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(taskId, tenantId);

    await db.runAsync(`
      UPDATE project_tasks
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return await db.getAsync(`
      SELECT 
        t.*,
        u1.first_name || ' ' || u1.last_name as created_by_name,
        u2.first_name || ' ' || u2.last_name as assigned_to_name
      FROM project_tasks t
      LEFT JOIN users u1 ON t.user_id = u1.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      WHERE t.id = ?
    `, [taskId]);
  }

  /**
   * Delete task
   */
  async deleteTask(tenantId, taskId) {
    const existing = await db.getAsync('SELECT * FROM project_tasks WHERE id = ? AND tenant_id = ?', [taskId, tenantId]);
    if (!existing) throw new Error('Task not found');
    await db.runAsync('DELETE FROM project_tasks WHERE id = ? AND tenant_id = ?', [taskId, tenantId]);
    return { success: true, deleted: existing };
  }

  /**
   * Add team member
   */
  async addTeamMember(tenantId, projectId, userId, role = 'member') {
    await db.runAsync(`
      INSERT OR REPLACE INTO project_team_members (tenant_id, project_id, user_id, role)
      VALUES (?, ?, ?, ?)
    `, [tenantId, projectId, userId, role]);

    return await db.getAsync(`
      SELECT 
        tm.*,
        u.first_name || ' ' || u.last_name as member_name,
        u.email as member_email
      FROM project_team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.project_id = ? AND tm.user_id = ? AND tm.tenant_id = ?
    `, [projectId, userId, tenantId]);
  }

  /**
   * Remove team member
   */
  async removeTeamMember(tenantId, projectId, userId) {
    await db.runAsync(`
      DELETE FROM project_team_members
      WHERE project_id = ? AND user_id = ? AND tenant_id = ?
    `, [projectId, userId, tenantId]);

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

module.exports = new ProjectManagementService();
