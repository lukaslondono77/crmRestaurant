const express = require('express');
const multer = require('multer');
const path = require('path');
const fileManagerService = require('../services/fileManagerService');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, formatSuccessResponse } = require('../utils/errorHandler');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tenantId = req.tenantId || 'default';
    const uploadPath = path.join(__dirname, '../../uploads/files', tenantId.toString());
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// GET /api/files/folders - Get all folders
router.get('/folders', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    parentFolderId: req.query.parentFolderId,
    isArchived: req.query.isArchived,
    search: req.query.search
  };

  const folders = await fileManagerService.getFolders(tenantId, filters);
  res.json(formatSuccessResponse(folders));
}));

// GET /api/files/folders/:id - Get folder by ID
router.get('/folders/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const folderId = parseInt(req.params.id);

  const folder = await fileManagerService.getFolderById(tenantId, folderId);
  res.json(formatSuccessResponse(folder));
}));

// POST /api/files/folders - Create folder
router.post('/folders', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;

  const folder = await fileManagerService.createFolder(tenantId, userId, req.body);
  res.status(201).json(formatSuccessResponse(folder));
}));

// PUT /api/files/folders/:id - Update folder
router.put('/folders/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const folderId = parseInt(req.params.id);

  const folder = await fileManagerService.updateFolder(tenantId, folderId, req.body);
  res.json(formatSuccessResponse(folder));
}));

// DELETE /api/files/folders/:id - Delete folder
router.delete('/folders/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const folderId = parseInt(req.params.id);

  const result = await fileManagerService.deleteFolder(tenantId, folderId);
  res.json(formatSuccessResponse(result));
}));

// GET /api/files - Get all files
router.get('/', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    folderId: req.query.folderId,
    userId: req.query.userId,
    isArchived: req.query.isArchived,
    isStarred: req.query.isStarred,
    fileType: req.query.fileType,
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit
  };

  const result = await fileManagerService.getFiles(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

// GET /api/files/stats - Get file statistics
router.get('/stats', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    userId: req.query.userId
  };

  const stats = await fileManagerService.getFileStats(tenantId, filters);
  res.json(formatSuccessResponse(stats));
}));

// GET /api/files/download/:fileId - Download file (authenticated, tenant-scoped)
const uploadsRoot = path.resolve(path.join(__dirname, '../../uploads'));
router.get('/download/:fileId', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const fileId = parseInt(req.params.fileId, 10);
  if (isNaN(fileId) || fileId < 1) {
    const { ApiError, ErrorCodes } = require('../utils/errorHandler');
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid file ID', null, 400);
  }
  let file;
  try {
    file = await fileManagerService.getFileById(tenantId, fileId);
  } catch (e) {
    const { ApiError, ErrorCodes } = require('../utils/errorHandler');
    throw new ApiError(ErrorCodes.NOT_FOUND, 'File not found', null, 404);
  }
  const absolutePath = path.resolve(file.file_path);
  if (!absolutePath.startsWith(uploadsRoot)) {
    const { ApiError, ErrorCodes } = require('../utils/errorHandler');
    throw new ApiError(ErrorCodes.FORBIDDEN, 'File not found', null, 404);
  }
  const filename = (file.original_name || file.file_name || 'download').replace(/"/g, '');
  res.sendFile(absolutePath, { headers: { 'Content-Disposition': `attachment; filename="${filename}"` } }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ success: false, error: { message: 'File not found' } });
  });
}));

// GET /api/files/:id - Get file by ID (metadata only)
router.get('/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const fileId = parseInt(req.params.id);

  const file = await fileManagerService.getFileById(tenantId, fileId);
  res.json(formatSuccessResponse(file));
}));

// POST /api/files/upload - Upload file
router.post('/upload', authenticate, tenantFilter, upload.single('file'), asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;

  if (!req.file) {
    throw new Error('No file uploaded');
  }

  let tags = null;
  if (req.body.tags) {
    try {
      const parsed = JSON.parse(req.body.tags);
      tags = Array.isArray(parsed) ? parsed : null;
    } catch (_) {
      tags = null;
    }
  }
  const fileData = {
    fileName: req.file.filename,
    originalName: req.file.originalname,
    filePath: req.file.path,
    fileSize: req.file.size,
    mimeType: req.file.mimetype,
    fileExtension: path.extname(req.file.originalname),
    folderId: req.body.folderId ? parseInt(req.body.folderId) : null,
    description: req.body.description,
    tags
  };

  // Determine file type
  const mimeType = req.file.mimetype;
  if (mimeType.startsWith('image/')) {
    fileData.fileType = 'image';
  } else if (mimeType.startsWith('video/')) {
    fileData.fileType = 'video';
  } else if (mimeType.startsWith('audio/')) {
    fileData.fileType = 'audio';
  } else if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) {
    fileData.fileType = 'document';
  } else {
    fileData.fileType = 'other';
  }

  const file = await fileManagerService.saveFile(tenantId, userId, fileData);
  res.status(201).json(formatSuccessResponse(file));
}));

// PUT /api/files/:id - Update file
router.put('/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const fileId = parseInt(req.params.id);

  const file = await fileManagerService.updateFile(tenantId, fileId, req.body);
  res.json(formatSuccessResponse(file));
}));

// DELETE /api/files/:id - Delete file
router.delete('/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const fileId = parseInt(req.params.id);

  const result = await fileManagerService.deleteFile(tenantId, fileId);
  res.json(formatSuccessResponse(result));
}));

// POST /api/files/share - Share file or folder
router.post('/share', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const sharedBy = req.user.id;
  const { fileId, folderId, sharedWith, permission = 'view', expiresAt } = req.body;

  if (!sharedWith) {
    throw new Error('sharedWith (user ID) is required');
  }

  const share = await fileManagerService.shareFile(tenantId, fileId, folderId, sharedBy, sharedWith, permission, expiresAt);
  res.status(201).json(formatSuccessResponse(share));
}));

module.exports = router;
