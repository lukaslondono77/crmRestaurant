const express = require('express');
const schoolService = require('../services/schoolService');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, formatSuccessResponse } = require('../utils/errorHandler');

const router = express.Router();

// Students routes
router.get('/students', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    grade: req.query.grade,
    class: req.query.class,
    status: req.query.status,
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit
  };
  const result = await schoolService.getStudents(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

router.get('/students/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const studentId = parseInt(req.params.id);
  const student = await schoolService.getStudentById(tenantId, studentId);
  res.json(formatSuccessResponse(student));
}));

router.post('/students', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const student = await schoolService.createStudent(tenantId, req.body);
  res.status(201).json(formatSuccessResponse(student));
}));

// Courses routes
router.get('/courses', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    teacherId: req.query.teacherId,
    gradeLevel: req.query.gradeLevel,
    status: req.query.status,
    page: req.query.page,
    limit: req.query.limit
  };
  const result = await schoolService.getCourses(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

router.post('/courses', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const course = await schoolService.createCourse(tenantId, req.body);
  res.status(201).json(formatSuccessResponse(course));
}));

// Enrollments routes
router.post('/enrollments', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { studentId, courseId } = req.body;
  const enrollment = await schoolService.enrollStudent(tenantId, studentId, courseId);
  res.status(201).json(formatSuccessResponse(enrollment));
}));

// Attendance routes
router.post('/attendance', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const attendance = await schoolService.recordAttendance(tenantId, req.body);
  res.status(201).json(formatSuccessResponse(attendance));
}));

// Grades routes
router.post('/grades', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { enrollmentId, ...gradeData } = req.body;
  const grade = await schoolService.addGrade(tenantId, enrollmentId, gradeData);
  res.status(201).json(formatSuccessResponse(grade));
}));

router.get('/enrollments/:enrollmentId/grades', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const enrollmentId = parseInt(req.params.enrollmentId);
  const grades = await schoolService.getStudentGrades(tenantId, enrollmentId);
  res.json(formatSuccessResponse(grades));
}));

module.exports = router;
