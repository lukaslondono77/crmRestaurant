const db = require('../config/database');
const { parsePaginationParams, formatPaginatedResponse } = require('../utils/pagination');

class LmsService {
  /**
   * Get all courses
   */
  async getCourses(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['c.tenant_id = ?'];
    const params = [tenantId];

    if (filters.instructorId) {
      whereConditions.push('c.instructor_id = ?');
      params.push(filters.instructorId);
    }

    if (filters.status) {
      whereConditions.push('c.status = ?');
      params.push(filters.status);
    }

    if (filters.category) {
      whereConditions.push('c.category = ?');
      params.push(filters.category);
    }

    if (filters.level) {
      whereConditions.push('c.level = ?');
      params.push(filters.level);
    }

    if (filters.search) {
      whereConditions.push('(c.title LIKE ? OR c.description LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM lms_courses c ${whereClause}`, params);
    const total = countResult?.total || 0;

    const courses = await db.allAsync(`
      SELECT 
        c.*,
        u.first_name || ' ' || u.last_name as instructor_name,
        (SELECT COUNT(*) FROM lms_enrollments WHERE course_id = c.id) as enrollment_count,
        (SELECT COUNT(*) FROM lms_lessons WHERE course_id = c.id) as lesson_count
      FROM lms_courses c
      LEFT JOIN users u ON c.instructor_id = u.id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const parsedCourses = courses.map(course => ({
      ...course,
      tags: course.tags ? (this._tryParseJSON(course.tags) || []) : []
    }));

    return formatPaginatedResponse(parsedCourses, total, page, limit);
  }

  /**
   * Get course by ID with lessons
   */
  async getCourseById(tenantId, courseId) {
    const course = await db.getAsync(`
      SELECT 
        c.*,
        u.first_name || ' ' || u.last_name as instructor_name
      FROM lms_courses c
      LEFT JOIN users u ON c.instructor_id = u.id
      WHERE c.id = ? AND c.tenant_id = ?
    `, [courseId, tenantId]);

    if (!course) {
      throw new Error('Course not found');
    }

    // Get lessons
    course.lessons = await db.allAsync(`
      SELECT * FROM lms_lessons
      WHERE course_id = ? AND tenant_id = ?
      ORDER BY order_index ASC, created_at ASC
    `, [courseId, tenantId]);

    course.lessons = course.lessons.map(lesson => ({
      ...lesson,
      is_free: Boolean(lesson.is_free)
    }));

    // Get enrollment count
    const enrollmentCount = await db.getAsync(`
      SELECT COUNT(*) as count FROM lms_enrollments
      WHERE course_id = ? AND tenant_id = ?
    `, [courseId, tenantId]);
    course.enrollment_count = enrollmentCount?.count || 0;

    return {
      ...course,
      tags: course.tags ? (this._tryParseJSON(course.tags) || []) : []
    };
  }

  /**
   * Create course
   */
  async createCourse(tenantId, courseData) {
    const {
      instructorId, title, description, category, level = 'beginner',
      status = 'draft', price = 0, imageUrl, durationHours, language = 'en', tags
    } = courseData;

    if (!title) {
      throw new Error('Course title is required');
    }

    const result = await db.runAsync(`
      INSERT INTO lms_courses (
        tenant_id, instructor_id, title, description, category, level,
        status, price, image_url, duration_hours, language, tags
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, instructorId || null, title, description || null, category || null,
      level, status, price, imageUrl || null, durationHours || null, language,
      tags ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : null
    ]);

    return this.getCourseById(tenantId, result.lastID);
  }

  /**
   * Update course
   */
  async updateCourse(tenantId, courseId, updateData) {
    const existing = await this.getCourseById(tenantId, courseId);

    const updates = [];
    const params = [];

    const fields = {
      instructorId: 'instructor_id',
      title: 'title',
      description: 'description',
      category: 'category',
      level: 'level',
      status: 'status',
      price: 'price',
      imageUrl: 'image_url',
      durationHours: 'duration_hours',
      language: 'language'
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
    params.push(courseId, tenantId);

    await db.runAsync(`
      UPDATE lms_courses
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return this.getCourseById(tenantId, courseId);
  }

  /**
   * Delete course
   */
  async deleteCourse(tenantId, courseId) {
    const existing = await this.getCourseById(tenantId, courseId);
    await db.runAsync('DELETE FROM lms_courses WHERE id = ? AND tenant_id = ?', [courseId, tenantId]);
    return { success: true, deleted: existing };
  }

  /**
   * Get lessons for course
   */
  async getLessons(tenantId, courseId) {
    const lessons = await db.allAsync(`
      SELECT * FROM lms_lessons
      WHERE course_id = ? AND tenant_id = ?
      ORDER BY order_index ASC, created_at ASC
    `, [courseId, tenantId]);

    return lessons.map(lesson => ({
      ...lesson,
      is_free: Boolean(lesson.is_free)
    }));
  }

  /**
   * Create lesson
   */
  async createLesson(tenantId, courseId, lessonData) {
    const {
      title, description, content, lessonType = 'video',
      videoUrl, durationMinutes, orderIndex, isFree = false
    } = lessonData;

    if (!title) {
      throw new Error('Lesson title is required');
    }

    // Get max order_index if not provided
    let finalOrderIndex = orderIndex;
    if (finalOrderIndex === undefined) {
      const maxOrder = await db.getAsync(`
        SELECT MAX(order_index) as max FROM lms_lessons
        WHERE course_id = ? AND tenant_id = ?
      `, [courseId, tenantId]);
      finalOrderIndex = (maxOrder?.max || -1) + 1;
    }

    const result = await db.runAsync(`
      INSERT INTO lms_lessons (
        tenant_id, course_id, title, description, content, lesson_type,
        video_url, duration_minutes, order_index, is_free
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, courseId, title, description || null, content || null,
      lessonType, videoUrl || null, durationMinutes || null, finalOrderIndex,
      isFree ? 1 : 0
    ]);

    return await db.getAsync('SELECT * FROM lms_lessons WHERE id = ?', [result.lastID]);
  }

  /**
   * Update lesson
   */
  async updateLesson(tenantId, lessonId, updateData) {
    const updates = [];
    const params = [];

    const fields = {
      title: 'title',
      description: 'description',
      content: 'content',
      lessonType: 'lesson_type',
      videoUrl: 'video_url',
      durationMinutes: 'duration_minutes',
      orderIndex: 'order_index'
    };

    Object.keys(fields).forEach(key => {
      if (updateData[key] !== undefined) {
        updates.push(`${fields[key]} = ?`);
        params.push(updateData[key] || null);
      }
    });

    if (updateData.isFree !== undefined) {
      updates.push('is_free = ?');
      params.push(updateData.isFree ? 1 : 0);
    }

    if (updates.length === 0) {
      return await db.getAsync('SELECT * FROM lms_lessons WHERE id = ? AND tenant_id = ?', [lessonId, tenantId]);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(lessonId, tenantId);

    await db.runAsync(`
      UPDATE lms_lessons
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return await db.getAsync('SELECT * FROM lms_lessons WHERE id = ?', [lessonId]);
  }

  /**
   * Delete lesson
   */
  async deleteLesson(tenantId, lessonId) {
    const existing = await db.getAsync('SELECT * FROM lms_lessons WHERE id = ? AND tenant_id = ?', [lessonId, tenantId]);
    if (!existing) throw new Error('Lesson not found');
    await db.runAsync('DELETE FROM lms_lessons WHERE id = ? AND tenant_id = ?', [lessonId, tenantId]);
    return { success: true, deleted: existing };
  }

  /**
   * Enroll student in course
   */
  async enrollStudent(tenantId, courseId, studentId) {
    // Check if already enrolled
    const existing = await db.getAsync(`
      SELECT * FROM lms_enrollments
      WHERE course_id = ? AND student_id = ? AND tenant_id = ?
    `, [courseId, studentId, tenantId]);

    if (existing) {
      return existing;
    }

    const result = await db.runAsync(`
      INSERT INTO lms_enrollments (tenant_id, course_id, student_id)
      VALUES (?, ?, ?)
    `, [tenantId, courseId, studentId]);

    return await db.getAsync('SELECT * FROM lms_enrollments WHERE id = ?', [result.lastID]);
  }

  /**
   * Get enrollments
   */
  async getEnrollments(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['e.tenant_id = ?'];
    const params = [tenantId];

    if (filters.courseId) {
      whereConditions.push('e.course_id = ?');
      params.push(filters.courseId);
    }

    if (filters.studentId) {
      whereConditions.push('e.student_id = ?');
      params.push(filters.studentId);
    }

    if (filters.status) {
      whereConditions.push('e.status = ?');
      params.push(filters.status);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM lms_enrollments e ${whereClause}`, params);
    const total = countResult?.total || 0;

    const enrollments = await db.allAsync(`
      SELECT 
        e.*,
        c.title as course_title,
        u.first_name || ' ' || u.last_name as student_name,
        u.email as student_email
      FROM lms_enrollments e
      JOIN lms_courses c ON e.course_id = c.id
      JOIN users u ON e.student_id = u.id
      ${whereClause}
      ORDER BY e.enrolled_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return formatPaginatedResponse(enrollments, total, page, limit);
  }

  /**
   * Update enrollment progress
   */
  async updateEnrollmentProgress(tenantId, enrollmentId, progress) {
    const updates = [];
    const params = [];

    if (progress !== undefined) {
      updates.push('progress = ?');
      params.push(progress);
    }

    if (progress === 100) {
      updates.push('completed_at = CURRENT_TIMESTAMP');
      updates.push('status = ?');
      params.push('completed');
    }

    if (updates.length === 0) {
      return await db.getAsync('SELECT * FROM lms_enrollments WHERE id = ? AND tenant_id = ?', [enrollmentId, tenantId]);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(enrollmentId, tenantId);

    await db.runAsync(`
      UPDATE lms_enrollments
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return await db.getAsync('SELECT * FROM lms_enrollments WHERE id = ?', [enrollmentId]);
  }

  /**
   * Update lesson progress
   */
  async updateLessonProgress(tenantId, enrollmentId, lessonId, progressData) {
    const { completed, progressPercentage, timeSpentMinutes } = progressData;

    // Get or create progress record
    let progress = await db.getAsync(`
      SELECT * FROM lms_lesson_progress
      WHERE enrollment_id = ? AND lesson_id = ? AND tenant_id = ?
    `, [enrollmentId, lessonId, tenantId]);

    if (!progress) {
      const result = await db.runAsync(`
        INSERT INTO lms_lesson_progress (
          tenant_id, enrollment_id, lesson_id, completed, progress_percentage, time_spent_minutes
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        tenantId, enrollmentId, lessonId,
        completed ? 1 : 0, progressPercentage || 0, timeSpentMinutes || 0
      ]);
      progress = await db.getAsync('SELECT * FROM lms_lesson_progress WHERE id = ?', [result.lastID]);
    } else {
      const updates = [];
      const params = [];

      if (completed !== undefined) {
        updates.push('completed = ?');
        updates.push('completed_at = ?');
        params.push(completed ? 1 : 0);
        params.push(completed ? new Date().toISOString() : null);
      }

      if (progressPercentage !== undefined) {
        updates.push('progress_percentage = ?');
        params.push(progressPercentage);
      }

      if (timeSpentMinutes !== undefined) {
        updates.push('time_spent_minutes = ?');
        params.push(timeSpentMinutes);
      }

      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(progress.id, tenantId);

        await db.runAsync(`
          UPDATE lms_lesson_progress
          SET ${updates.join(', ')}
          WHERE id = ? AND tenant_id = ?
        `, params);

        progress = await db.getAsync('SELECT * FROM lms_lesson_progress WHERE id = ?', [progress.id]);
      }
    }

    // Update overall enrollment progress
    const totalLessons = await db.getAsync(`
      SELECT COUNT(*) as total FROM lms_lessons
      WHERE course_id = (SELECT course_id FROM lms_enrollments WHERE id = ?)
    `, [enrollmentId]);

    const completedLessons = await db.getAsync(`
      SELECT COUNT(*) as total FROM lms_lesson_progress
      WHERE enrollment_id = ? AND completed = 1
    `, [enrollmentId]);

    const overallProgress = totalLessons?.total > 0
      ? Math.round((completedLessons?.total || 0) / totalLessons.total * 100)
      : 0;

    await this.updateEnrollmentProgress(tenantId, enrollmentId, overallProgress);

    return {
      ...progress,
      completed: Boolean(progress.completed)
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

module.exports = new LmsService();
