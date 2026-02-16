const express = require('express');
const projectManagementService = require('../services/projectManagementService');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, formatSuccessResponse } = require('../utils/errorHandler');

const router = express.Router();

// Projects routes
router.get('/projects', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    userId: req.query.userId,
    status: req.query.status,
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit
  };
  const result = await projectManagementService.getProjects(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

router.get('/projects/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const projectId = parseInt(req.params.id);
  const project = await projectManagementService.getProjectById(tenantId, projectId);
  res.json(formatSuccessResponse(project));
}));

router.post('/projects', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const project = await projectManagementService.createProject(tenantId, userId, req.body);
  res.status(201).json(formatSuccessResponse(project));
}));

router.put('/projects/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const projectId = parseInt(req.params.id);
  const project = await projectManagementService.updateProject(tenantId, projectId, req.body);
  res.json(formatSuccessResponse(project));
}));

router.delete('/projects/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const projectId = parseInt(req.params.id);
  const result = await projectManagementService.deleteProject(tenantId, projectId);
  res.json(formatSuccessResponse(result));
}));

// Tasks routes
router.get('/projects/:projectId/tasks', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const projectId = parseInt(req.params.projectId);
  const filters = {
    status: req.query.status,
    assignedTo: req.query.assignedTo
  };
  const tasks = await projectManagementService.getTasks(tenantId, projectId, filters);
  res.json(formatSuccessResponse(tasks));
}));

router.post('/projects/:projectId/tasks', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const projectId = parseInt(req.params.projectId);
  const userId = req.user.id;
  const task = await projectManagementService.createTask(tenantId, projectId, userId, req.body);
  res.status(201).json(formatSuccessResponse(task));
}));

router.put('/tasks/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const taskId = parseInt(req.params.id);
  const task = await projectManagementService.updateTask(tenantId, taskId, req.body);
  res.json(formatSuccessResponse(task));
}));

router.delete('/tasks/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const taskId = parseInt(req.params.id);
  const result = await projectManagementService.deleteTask(tenantId, taskId);
  res.json(formatSuccessResponse(result));
}));

// Team members routes
router.post('/projects/:projectId/team', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const projectId = parseInt(req.params.projectId);
  const { userId, role } = req.body;
  const member = await projectManagementService.addTeamMember(tenantId, projectId, userId, role);
  res.status(201).json(formatSuccessResponse(member));
}));

router.delete('/projects/:projectId/team/:userId', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const projectId = parseInt(req.params.projectId);
  const userId = parseInt(req.params.userId);
  const result = await projectManagementService.removeTeamMember(tenantId, projectId, userId);
  res.json(formatSuccessResponse(result));
}));

module.exports = router;
