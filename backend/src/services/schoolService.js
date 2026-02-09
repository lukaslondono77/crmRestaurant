const db = require('../config/database');
const { parsePaginationParams, formatPaginatedResponse } = require('../utils/pagination');

class SchoolService {
  /**
   * Generate unique student ID
   */
  _generateStudentId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `STU-${timestamp}-${random}`;
  }

  /**
   * Get all students
   */
  async getStudents(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['s.tenant_id = ?'];
    const params = [tenantId];

    if (filters.grade) {
      whereConditions.push('s.grade = ?');
      params.push(filters.grade);
    }

    if (filters.class) {
      whereConditions.push('s.class = ?');
      params.push(filters.class);
    }

    if (filters.status) {
      whereConditions.push('s.status = ?');
      params.push(filters.status);
    }

    if (filters.search) {
      whereConditions.push('(s.first_name LIKE ? OR s.last_name LIKE ? OR s.email LIKE ? OR s.student_id LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM school_students s ${whereClause}`, params);
    const total = countResult?.total || 0;

    const students = await db.allAsync(`
      SELECT * FROM school_students s
      ${whereClause}
      ORDER BY s.last_name ASC, s.first_name ASC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return formatPaginatedResponse(students, total, page, limit);
  }

  /**
   * Get student by ID
   */
  async getStudentById(tenantId, studentId) {
    const student = await db.getAsync(`
      SELECT * FROM school_students
      WHERE id = ? AND tenant_id = ?
    `, [studentId, tenantId]);

    if (!student) {
      throw new Error('Student not found');
    }

    // Get enrollments
    student.enrollments = await db.allAsync(`
      SELECT 
        e.*,
        c.course_name,
        c.course_code,
        u.first_name || ' ' || u.last_name as teacher_name
      FROM school_enrollments e
      JOIN school_courses c ON e.course_id = c.id
      LEFT JOIN users u ON c.teacher_id = u.id
      WHERE e.student_id = ? AND e.tenant_id = ?
    `, [studentId, tenantId]);

    return student;
  }

  /**
   * Create student
   */
  async createStudent(tenantId, studentData) {
    const {
      firstName, lastName, email, phone, dateOfBirth, gender,
      address, parentName, parentEmail, parentPhone,
      enrollmentDate, grade, class: className, status = 'active', notes
    } = studentData;

    if (!firstName || !lastName) {
      throw new Error('First name and last name are required');
    }

    const studentId = this._generateStudentId();

    const result = await db.runAsync(`
      INSERT INTO school_students (
        tenant_id, student_id, first_name, last_name, email, phone,
        date_of_birth, gender, address, parent_name, parent_email,
        parent_phone, enrollment_date, grade, class, status, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, studentId, firstName, lastName, email || null, phone || null,
      dateOfBirth || null, gender || null, address || null,
      parentName || null, parentEmail || null, parentPhone || null,
      enrollmentDate || null, grade || null, className || null,
      status, notes || null
    ]);

    return this.getStudentById(tenantId, result.lastID);
  }

  /**
   * Get all courses
   */
  async getCourses(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['c.tenant_id = ?'];
    const params = [tenantId];

    if (filters.teacherId) {
      whereConditions.push('c.teacher_id = ?');
      params.push(filters.teacherId);
    }

    if (filters.gradeLevel) {
      whereConditions.push('c.grade_level = ?');
      params.push(filters.gradeLevel);
    }

    if (filters.status) {
      whereConditions.push('c.status = ?');
      params.push(filters.status);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM school_courses c ${whereClause}`, params);
    const total = countResult?.total || 0;

    const courses = await db.allAsync(`
      SELECT 
        c.*,
        u.first_name || ' ' || u.last_name as teacher_name,
        (SELECT COUNT(*) FROM school_enrollments WHERE course_id = c.id) as enrollment_count
      FROM school_courses c
      LEFT JOIN users u ON c.teacher_id = u.id
      ${whereClause}
      ORDER BY c.course_name ASC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return formatPaginatedResponse(courses, total, page, limit);
  }

  /**
   * Create course
   */
  async createCourse(tenantId, courseData) {
    const {
      teacherId, courseCode, courseName, description, gradeLevel,
      credits = 0, maxStudents, schedule, room, status = 'active'
    } = courseData;

    if (!courseName) {
      throw new Error('Course name is required');
    }

    // Generate course code if not provided
    let finalCourseCode = courseCode;
    if (!finalCourseCode) {
      finalCourseCode = `CRS-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    }

    const result = await db.runAsync(`
      INSERT INTO school_courses (
        tenant_id, teacher_id, course_code, course_name, description,
        grade_level, credits, max_students, schedule, room, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, teacherId || null, finalCourseCode, courseName,
      description || null, gradeLevel || null, credits, maxStudents || null,
      schedule || null, room || null, status
    ]);

    return await db.getAsync(`
      SELECT 
        c.*,
        u.first_name || ' ' || u.last_name as teacher_name
      FROM school_courses c
      LEFT JOIN users u ON c.teacher_id = u.id
      WHERE c.id = ?
    `, [result.lastID]);
  }

  /**
   * Enroll student in course
   */
  async enrollStudent(tenantId, studentId, courseId) {
    // Check if already enrolled
    const existing = await db.getAsync(`
      SELECT * FROM school_enrollments
      WHERE student_id = ? AND course_id = ? AND tenant_id = ?
    `, [studentId, courseId, tenantId]);

    if (existing) {
      return existing;
    }

    const result = await db.runAsync(`
      INSERT INTO school_enrollments (tenant_id, student_id, course_id)
      VALUES (?, ?, ?)
    `, [tenantId, studentId, courseId]);

    return await db.getAsync(`
      SELECT 
        e.*,
        s.first_name || ' ' || s.last_name as student_name,
        c.course_name
      FROM school_enrollments e
      JOIN school_students s ON e.student_id = s.id
      JOIN school_courses c ON e.course_id = c.id
      WHERE e.id = ?
    `, [result.lastID]);
  }

  /**
   * Record attendance
   */
  async recordAttendance(tenantId, attendanceData) {
    const { studentId, courseId, date, status: attendanceStatus, notes } = attendanceData;

    const attendanceDate = date || new Date().toISOString().split('T')[0];

    // Check if record exists
    const existing = await db.getAsync(`
      SELECT * FROM school_attendance
      WHERE student_id = ? AND date = ? AND (course_id = ? OR (? IS NULL AND course_id IS NULL)) AND tenant_id = ?
    `, [studentId, attendanceDate, courseId, courseId, tenantId]);

    if (existing) {
      await db.runAsync(`
        UPDATE school_attendance
        SET status = ?, notes = ?
        WHERE id = ?
      `, [attendanceStatus || 'present', notes || null, existing.id]);

      return await db.getAsync('SELECT * FROM school_attendance WHERE id = ?', [existing.id]);
    } else {
      const result = await db.runAsync(`
        INSERT INTO school_attendance (tenant_id, student_id, course_id, date, status, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [tenantId, studentId, courseId || null, attendanceDate, attendanceStatus || 'present', notes || null]);

      return await db.getAsync('SELECT * FROM school_attendance WHERE id = ?', [result.lastID]);
    }
  }

  /**
   * Add grade
   */
  async addGrade(tenantId, enrollmentId, gradeData) {
    const {
      assignmentName, assignmentType, pointsEarned, pointsPossible,
      dueDate, submittedDate, notes
    } = gradeData;

    if (!assignmentName) {
      throw new Error('Assignment name is required');
    }

    const percentage = pointsPossible > 0 ? (pointsEarned / pointsPossible) * 100 : 0;
    
    // Calculate letter grade
    let letterGrade = 'F';
    if (percentage >= 90) letterGrade = 'A';
    else if (percentage >= 80) letterGrade = 'B';
    else if (percentage >= 70) letterGrade = 'C';
    else if (percentage >= 60) letterGrade = 'D';

    const result = await db.runAsync(`
      INSERT INTO school_grades (
        tenant_id, enrollment_id, assignment_name, assignment_type,
        points_earned, points_possible, percentage, grade,
        due_date, submitted_date, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, enrollmentId, assignmentName, assignmentType || null,
      pointsEarned || 0, pointsPossible || 0, percentage, letterGrade,
      dueDate || null, submittedDate || null, notes || null
    ]);

    return await db.getAsync('SELECT * FROM school_grades WHERE id = ?', [result.lastID]);
  }

  /**
   * Get student grades
   */
  async getStudentGrades(tenantId, enrollmentId) {
    const grades = await db.allAsync(`
      SELECT * FROM school_grades
      WHERE enrollment_id = ? AND tenant_id = ?
      ORDER BY due_date DESC, created_at DESC
    `, [enrollmentId, tenantId]);

    // Calculate overall grade
    let totalPoints = 0;
    let totalPossible = 0;
    grades.forEach(grade => {
      totalPoints += grade.points_earned || 0;
      totalPossible += grade.points_possible || 0;
    });

    const overallPercentage = totalPossible > 0 ? (totalPoints / totalPossible) * 100 : 0;
    let overallGrade = 'F';
    if (overallPercentage >= 90) overallGrade = 'A';
    else if (overallPercentage >= 80) overallGrade = 'B';
    else if (overallPercentage >= 70) overallGrade = 'C';
    else if (overallPercentage >= 60) overallGrade = 'D';

    return {
      grades,
      summary: {
        totalPoints,
        totalPossible,
        percentage: overallPercentage,
        letterGrade: overallGrade
      }
    };
  }
}

module.exports = new SchoolService();
