const express = require('express');
const lmsService = require('../services/lmsService');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, formatSuccessResponse } = require('../utils/errorHandler');

const router = express.Router();

// Courses routes
router.get('/courses', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    instructorId: req.query.instructorId,
    status: req.query.status,
    category: req.query.category,
    level: req.query.level,
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit
  };
  const result = await lmsService.getCourses(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

router.get('/courses/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const courseId = parseInt(req.params.id);
  const course = await lmsService.getCourseById(tenantId, courseId);
  res.json(formatSuccessResponse(course));
}));

router.post('/courses', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const course = await lmsService.createCourse(tenantId, req.body);
  res.status(201).json(formatSuccessResponse(course));
}));

router.put('/courses/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const courseId = parseInt(req.params.id);
  const course = await lmsService.updateCourse(tenantId, courseId, req.body);
  res.json(formatSuccessResponse(course));
}));

router.delete('/courses/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const courseId = parseInt(req.params.id);
  const result = await lmsService.deleteCourse(tenantId, courseId);
  res.json(formatSuccessResponse(result));
}));

// Lessons routes
router.get('/courses/:courseId/lessons', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const courseId = parseInt(req.params.courseId);
  const lessons = await lmsService.getLessons(tenantId, courseId);
  res.json(formatSuccessResponse(lessons));
}));

router.post('/courses/:courseId/lessons', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const courseId = parseInt(req.params.courseId);
  const lesson = await lmsService.createLesson(tenantId, courseId, req.body);
  res.status(201).json(formatSuccessResponse(lesson));
}));

router.put('/lessons/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const lessonId = parseInt(req.params.id);
  const lesson = await lmsService.updateLesson(tenantId, lessonId, req.body);
  res.json(formatSuccessResponse(lesson));
}));

router.delete('/lessons/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const lessonId = parseInt(req.params.id);
  const result = await lmsService.deleteLesson(tenantId, lessonId);
  res.json(formatSuccessResponse(result));
}));

// Enrollments routes
router.get('/enrollments', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    courseId: req.query.courseId,
    studentId: req.query.studentId,
    status: req.query.status,
    page: req.query.page,
    limit: req.query.limit
  };
  const result = await lmsService.getEnrollments(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

router.post('/courses/:courseId/enroll', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const courseId = parseInt(req.params.courseId);
  const studentId = req.user.id;
  const enrollment = await lmsService.enrollStudent(tenantId, courseId, studentId);
  res.status(201).json(formatSuccessResponse(enrollment));
}));

router.put('/enrollments/:id/progress', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const enrollmentId = parseInt(req.params.id);
  const { progress } = req.body;
  const enrollment = await lmsService.updateEnrollmentProgress(tenantId, enrollmentId, progress);
  res.json(formatSuccessResponse(enrollment));
}));

// Lesson progress routes
router.put('/enrollments/:enrollmentId/lessons/:lessonId/progress', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const enrollmentId = parseInt(req.params.enrollmentId);
  const lessonId = parseInt(req.params.lessonId);
  const progress = await lmsService.updateLessonProgress(tenantId, enrollmentId, lessonId, req.body);
  res.json(formatSuccessResponse(progress));
}));

module.exports = router;
