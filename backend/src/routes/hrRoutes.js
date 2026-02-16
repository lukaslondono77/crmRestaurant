const express = require('express');
const hrService = require('../services/hrService');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, formatSuccessResponse } = require('../utils/errorHandler');

const router = express.Router();

// Employees routes
router.get('/employees', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    department: req.query.department,
    status: req.query.status,
    employmentType: req.query.employmentType,
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit
  };
  const result = await hrService.getEmployees(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

router.get('/employees/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const employeeId = parseInt(req.params.id);
  const employee = await hrService.getEmployeeById(tenantId, employeeId);
  res.json(formatSuccessResponse(employee));
}));

router.post('/employees', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const employee = await hrService.createEmployee(tenantId, req.body);
  res.status(201).json(formatSuccessResponse(employee));
}));

router.put('/employees/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const employeeId = parseInt(req.params.id);
  const employee = await hrService.updateEmployee(tenantId, employeeId, req.body);
  res.json(formatSuccessResponse(employee));
}));

// Attendance routes
router.get('/attendance', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    employeeId: req.query.employeeId,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    status: req.query.status,
    page: req.query.page,
    limit: req.query.limit
  };
  const result = await hrService.getAttendance(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

router.post('/attendance', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { employeeId, ...attendanceData } = req.body;
  const attendance = await hrService.recordAttendance(tenantId, employeeId, attendanceData);
  res.status(201).json(formatSuccessResponse(attendance));
}));

// Leave requests routes
router.get('/leave-requests', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    employeeId: req.query.employeeId,
    status: req.query.status,
    leaveType: req.query.leaveType,
    page: req.query.page,
    limit: req.query.limit
  };
  const result = await hrService.getLeaveRequests(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

router.post('/leave-requests', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { employeeId, ...requestData } = req.body;
  const request = await hrService.createLeaveRequest(tenantId, employeeId, requestData);
  res.status(201).json(formatSuccessResponse(request));
}));

router.put('/leave-requests/:id/status', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const requestId = parseInt(req.params.id);
  const { status, approvedBy, rejectionReason } = req.body;
  const request = await hrService.updateLeaveRequestStatus(tenantId, requestId, status, approvedBy, rejectionReason);
  res.json(formatSuccessResponse(request));
}));

// Payroll routes
router.get('/payroll', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    employeeId: req.query.employeeId,
    status: req.query.status,
    page: req.query.page,
    limit: req.query.limit
  };
  const result = await hrService.getPayroll(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

router.post('/payroll', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { employeeId, ...payrollData } = req.body;
  const payroll = await hrService.createPayroll(tenantId, employeeId, payrollData);
  res.status(201).json(formatSuccessResponse(payroll));
}));

// Departments routes
router.get('/departments', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const departments = await hrService.getDepartments(tenantId);
  res.json(formatSuccessResponse(departments));
}));

router.post('/departments', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const department = await hrService.createDepartment(tenantId, req.body);
  res.status(201).json(formatSuccessResponse(department));
}));

module.exports = router;
