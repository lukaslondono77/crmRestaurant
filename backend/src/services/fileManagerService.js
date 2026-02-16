const db = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const { parsePaginationParams, formatPaginatedResponse } = require('../utils/pagination');

class FileManagerService {
  /**
   * Get all folders
   */
  async getFolders(tenantId, filters = {}) {
    const alias = 'f';
    let whereConditions = [`${alias}.tenant_id = ?`];
    const params = [tenantId];

    if (filters.parentFolderId !== undefined) {
      whereConditions.push(`${alias}.parent_folder_id = ?`);
      params.push(filters.parentFolderId || null);
    }

    if (filters.isArchived !== undefined) {
      whereConditions.push(`${alias}.is_archived = ?`);
      params.push(filters.isArchived ? 1 : 0);
    }

    if (filters.search) {
      whereConditions.push(`${alias}.name LIKE ?`);
      params.push(`%${filters.search}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const folders = await db.allAsync(`
      SELECT 
        f.*,
        u.first_name || ' ' || u.last_name as created_by_name,
        (SELECT COUNT(*) FROM file_files WHERE folder_id = f.id AND tenant_id = ?) as file_count
      FROM file_folders f
      LEFT JOIN users u ON f.user_id = u.id
      ${whereClause}
      ORDER BY f.name ASC
    `, [tenantId, ...params]);

    return folders.map(folder => ({
      ...folder,
      is_archived: Boolean(folder.is_archived),
      file_count: folder.file_count || 0
    }));
  }

  /**
   * Get folder by ID
   */
  async getFolderById(tenantId, folderId) {
    const folder = await db.getAsync(`
      SELECT 
        f.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM file_folders f
      LEFT JOIN users u ON f.user_id = u.id
      WHERE f.id = ? AND f.tenant_id = ?
    `, [folderId, tenantId]);

    if (!folder) {
      throw new Error('Folder not found');
    }

    return {
      ...folder,
      is_archived: Boolean(folder.is_archived)
    };
  }

  /**
   * Sanitize folder name: no path segments, no traversal
   */
  _sanitizeFolderName(name) {
    if (typeof name !== 'string') return '';
    const sanitized = name.replace(/[/\\..\0]/g, '').trim();
    return sanitized;
  }

  /**
   * Create folder
   */
  async createFolder(tenantId, userId, folderData) {
    const { name, parentFolderId } = folderData;

    const sanitizedName = this._sanitizeFolderName(name);
    if (!sanitizedName) {
      throw new Error('Folder name is required and must not contain / \\ . or null');
    }

    let folderPath = sanitizedName;
    if (parentFolderId) {
      const parent = await this.getFolderById(tenantId, parentFolderId);
      if (!parent.path || /\.\.|[\/\\]/.test(parent.path)) {
        throw new Error('Invalid parent folder path');
      }
      folderPath = `${parent.path}/${sanitizedName}`;
    }

    // Check if folder with same name exists in same parent
    const existing = await db.getAsync(`
      SELECT id FROM file_folders
      WHERE tenant_id = ? AND parent_folder_id = ? AND name = ?
    `, [tenantId, parentFolderId || null, sanitizedName]);

    if (existing) {
      throw new Error('Folder with this name already exists');
    }

    const result = await db.runAsync(`
      INSERT INTO file_folders (tenant_id, user_id, parent_folder_id, name, path)
      VALUES (?, ?, ?, ?, ?)
    `, [tenantId, userId, parentFolderId || null, sanitizedName, folderPath]);

    // Create physical folder (path is sanitized; no traversal)
    const uploadsDir = path.join(__dirname, '../../uploads/files');
    const physicalPath = path.join(uploadsDir, tenantId.toString(), folderPath);
    const resolvedPath = path.resolve(physicalPath);
    if (!resolvedPath.startsWith(path.resolve(uploadsDir))) {
      throw new Error('Invalid folder path');
    }
    await fs.mkdir(resolvedPath, { recursive: true });

    return this.getFolderById(tenantId, result.lastID);
  }

  /**
   * Update folder
   */
  async updateFolder(tenantId, folderId, updateData) {
    const existing = await this.getFolderById(tenantId, folderId);

    const updates = [];
    const params = [];

    if (updateData.name !== undefined) {
      updates.push('name = ?');
      params.push(updateData.name);
    }

    if (updateData.isArchived !== undefined) {
      updates.push('is_archived = ?');
      params.push(updateData.isArchived ? 1 : 0);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(folderId, tenantId);

    await db.runAsync(`
      UPDATE file_folders
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return this.getFolderById(tenantId, folderId);
  }

  /**
   * Delete folder
   */
  async deleteFolder(tenantId, folderId) {
    const existing = await this.getFolderById(tenantId, folderId);
    
    // Check if folder has files or subfolders
    const fileCount = await db.getAsync(`
      SELECT COUNT(*) as count FROM file_files
      WHERE folder_id = ? AND tenant_id = ?
    `, [folderId, tenantId]);

    const subfolderCount = await db.getAsync(`
      SELECT COUNT(*) as count FROM file_folders
      WHERE parent_folder_id = ? AND tenant_id = ?
    `, [folderId, tenantId]);

    if (fileCount?.count > 0 || subfolderCount?.count > 0) {
      throw new Error('Cannot delete folder with files or subfolders');
    }

    await db.runAsync('DELETE FROM file_folders WHERE id = ? AND tenant_id = ?', [folderId, tenantId]);
    return { success: true, deleted: existing };
  }

  /**
   * Get files with filters
   */
  async getFiles(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['tenant_id = ?'];
    const params = [tenantId];

    if (filters.folderId !== undefined) {
      whereConditions.push('folder_id = ?');
      params.push(filters.folderId || null);
    }

    if (filters.userId) {
      whereConditions.push('user_id = ?');
      params.push(filters.userId);
    }

    if (filters.isArchived !== undefined) {
      whereConditions.push('is_archived = ?');
      params.push(filters.isArchived ? 1 : 0);
    }

    if (filters.isStarred !== undefined) {
      whereConditions.push('is_starred = ?');
      params.push(filters.isStarred ? 1 : 0);
    }

    if (filters.fileType) {
      whereConditions.push('file_type = ?');
      params.push(filters.fileType);
    }

    if (filters.search) {
      whereConditions.push('(file_name LIKE ? OR original_name LIKE ? OR description LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM file_files ${whereClause}`, params);
    const total = countResult?.total || 0;

    const files = await db.allAsync(`
      SELECT 
        f.*,
        u.first_name || ' ' || u.last_name as uploaded_by_name,
        folder.name as folder_name
      FROM file_files f
      LEFT JOIN users u ON f.user_id = u.id
      LEFT JOIN file_folders folder ON f.folder_id = folder.id
      ${whereClause}
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const parsedFiles = files.map(file => ({
      ...file,
      is_starred: Boolean(file.is_starred),
      is_archived: Boolean(file.is_archived),
      is_shared: Boolean(file.is_shared),
      tags: file.tags ? (this._tryParseJSON(file.tags) || []) : []
    }));

    return formatPaginatedResponse(parsedFiles, total, page, limit);
  }

  /**
   * Get file by ID
   */
  async getFileById(tenantId, fileId) {
    const file = await db.getAsync(`
      SELECT 
        f.*,
        u.first_name || ' ' || u.last_name as uploaded_by_name,
        folder.name as folder_name
      FROM file_files f
      LEFT JOIN users u ON f.user_id = u.id
      LEFT JOIN file_folders folder ON f.folder_id = folder.id
      WHERE f.id = ? AND f.tenant_id = ?
    `, [fileId, tenantId]);

    if (!file) {
      throw new Error('File not found');
    }

    return {
      ...file,
      is_starred: Boolean(file.is_starred),
      is_archived: Boolean(file.is_archived),
      is_shared: Boolean(file.is_shared),
      tags: file.tags ? (this._tryParseJSON(file.tags) || []) : []
    };
  }

  /**
   * Save file record (after upload)
   */
  async saveFile(tenantId, userId, fileData) {
    const {
      fileName,
      originalName,
      filePath,
      fileSize,
      fileType,
      mimeType,
      fileExtension,
      folderId,
      description,
      tags
    } = fileData;

    if (!fileName || !filePath || !fileSize) {
      throw new Error('File name, path, and size are required');
    }

    const result = await db.runAsync(`
      INSERT INTO file_files (
        tenant_id, folder_id, user_id, file_name, original_name, file_path,
        file_size, file_type, mime_type, file_extension, description, tags
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId,
      folderId || null,
      userId,
      fileName,
      originalName || fileName,
      filePath,
      fileSize,
      fileType || null,
      mimeType || null,
      fileExtension || null,
      description || null,
      tags ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : null
    ]);

    return this.getFileById(tenantId, result.lastID);
  }

  /**
   * Update file
   */
  async updateFile(tenantId, fileId, updateData) {
    const existing = await this.getFileById(tenantId, fileId);

    const updates = [];
    const params = [];

    if (updateData.fileName !== undefined) {
      updates.push('file_name = ?');
      params.push(updateData.fileName);
    }

    if (updateData.description !== undefined) {
      updates.push('description = ?');
      params.push(updateData.description || null);
    }

    if (updateData.folderId !== undefined) {
      updates.push('folder_id = ?');
      params.push(updateData.folderId || null);
    }

    if (updateData.isStarred !== undefined) {
      updates.push('is_starred = ?');
      params.push(updateData.isStarred ? 1 : 0);
    }

    if (updateData.isArchived !== undefined) {
      updates.push('is_archived = ?');
      params.push(updateData.isArchived ? 1 : 0);
    }

    if (updateData.tags !== undefined) {
      updates.push('tags = ?');
      params.push(updateData.tags ? (Array.isArray(updateData.tags) ? JSON.stringify(updateData.tags) : updateData.tags) : null);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(fileId, tenantId);

    await db.runAsync(`
      UPDATE file_files
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return this.getFileById(tenantId, fileId);
  }

  /**
   * Delete file
   */
  async deleteFile(tenantId, fileId) {
    const existing = await this.getFileById(tenantId, fileId);
    
    // Delete physical file
    try {
      await fs.unlink(existing.file_path);
    } catch (err) {
      console.warn('Could not delete physical file:', err);
    }

    await db.runAsync('DELETE FROM file_files WHERE id = ? AND tenant_id = ?', [fileId, tenantId]);
    return { success: true, deleted: existing };
  }

  /**
   * Get file statistics
   */
  async getFileStats(tenantId, filters = {}) {
    let whereConditions = ['tenant_id = ?'];
    const params = [tenantId];

    if (filters.userId) {
      whereConditions.push('user_id = ?');
      params.push(filters.userId);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const stats = await db.getAsync(`
      SELECT 
        COUNT(*) as total_files,
        SUM(file_size) as total_size,
        SUM(CASE WHEN is_starred = 1 THEN 1 ELSE 0 END) as starred,
        SUM(CASE WHEN is_shared = 1 THEN 1 ELSE 0 END) as shared,
        SUM(CASE WHEN file_type = 'image' THEN 1 ELSE 0 END) as images,
        SUM(CASE WHEN file_type = 'document' THEN 1 ELSE 0 END) as documents,
        SUM(CASE WHEN file_type = 'video' THEN 1 ELSE 0 END) as videos,
        SUM(CASE WHEN file_type = 'audio' THEN 1 ELSE 0 END) as audio
      FROM file_files
      ${whereClause}
    `, params);

    return stats || {
      total_files: 0,
      total_size: 0,
      starred: 0,
      shared: 0,
      images: 0,
      documents: 0,
      videos: 0,
      audio: 0
    };
  }

  /**
   * Share file or folder
   */
  async shareFile(tenantId, fileId, folderId, sharedBy, sharedWith, permission = 'view', expiresAt) {
    if (!fileId && !folderId) {
      throw new Error('Either file ID or folder ID is required');
    }

    const result = await db.runAsync(`
      INSERT INTO file_shares (
        tenant_id, file_id, folder_id, shared_by, shared_with, permission, expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId,
      fileId || null,
      folderId || null,
      sharedBy,
      sharedWith,
      permission,
      expiresAt || null
    ]);

    // Update file/folder is_shared flag
    if (fileId) {
      await db.runAsync('UPDATE file_files SET is_shared = 1 WHERE id = ?', [fileId]);
    }
    // Note: folders don't have is_shared flag, but we could add it if needed

    return await db.getAsync('SELECT * FROM file_shares WHERE id = ?', [result.lastID]);
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

module.exports = new FileManagerService();
