-- School Students Table
CREATE TABLE IF NOT EXISTS school_students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    student_id TEXT UNIQUE, -- Student ID/Number
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    date_of_birth DATE,
    gender TEXT, -- 'male', 'female', 'other'
    address TEXT,
    parent_name TEXT,
    parent_email TEXT,
    parent_phone TEXT,
    enrollment_date DATE,
    grade TEXT, -- '1', '2', '3', etc.
    class TEXT,
    status TEXT DEFAULT 'active', -- 'active', 'graduated', 'transferred', 'dropped'
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- School Courses Table
CREATE TABLE IF NOT EXISTS school_courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    teacher_id INTEGER, -- User ID of teacher
    course_code TEXT UNIQUE,
    course_name TEXT NOT NULL,
    description TEXT,
    grade_level TEXT,
    credits REAL DEFAULT 0,
    max_students INTEGER,
    schedule TEXT, -- JSON or text description
    room TEXT,
    status TEXT DEFAULT 'active', -- 'active', 'completed', 'cancelled'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL
);

-- School Enrollments Table
CREATE TABLE IF NOT EXISTS school_enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'enrolled', -- 'enrolled', 'completed', 'dropped', 'failed'
    final_grade TEXT, -- 'A', 'B', 'C', 'D', 'F'
    attendance_percentage REAL DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES school_students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES school_courses(id) ON DELETE CASCADE,
    UNIQUE(student_id, course_id)
);

-- School Attendance Table
CREATE TABLE IF NOT EXISTS school_attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    course_id INTEGER,
    date DATE NOT NULL,
    status TEXT DEFAULT 'present', -- 'present', 'absent', 'late', 'excused'
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES school_students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES school_courses(id) ON DELETE SET NULL,
    UNIQUE(student_id, date, course_id)
);

-- School Grades Table
CREATE TABLE IF NOT EXISTS school_grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    enrollment_id INTEGER NOT NULL,
    assignment_name TEXT NOT NULL,
    assignment_type TEXT, -- 'homework', 'quiz', 'test', 'project', 'final'
    points_earned REAL,
    points_possible REAL,
    percentage REAL,
    grade TEXT, -- 'A', 'B', 'C', 'D', 'F'
    due_date DATE,
    submitted_date DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (enrollment_id) REFERENCES school_enrollments(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_school_students_tenant ON school_students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_school_students_grade ON school_students(grade);
CREATE INDEX IF NOT EXISTS idx_school_courses_tenant ON school_courses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_school_courses_teacher ON school_courses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_school_enrollments_student ON school_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_school_enrollments_course ON school_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_school_attendance_student ON school_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_school_attendance_date ON school_attendance(date);
CREATE INDEX IF NOT EXISTS idx_school_grades_enrollment ON school_grades(enrollment_id);
