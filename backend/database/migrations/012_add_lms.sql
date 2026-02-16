-- LMS Courses Table
CREATE TABLE IF NOT EXISTS lms_courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    instructor_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    level TEXT DEFAULT 'beginner', -- 'beginner', 'intermediate', 'advanced'
    status TEXT DEFAULT 'draft', -- 'draft', 'published', 'archived'
    price REAL DEFAULT 0,
    image_url TEXT,
    duration_hours REAL,
    language TEXT DEFAULT 'en',
    tags TEXT, -- JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE SET NULL
);

-- LMS Lessons Table
CREATE TABLE IF NOT EXISTS lms_lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT, -- HTML or markdown content
    lesson_type TEXT DEFAULT 'video', -- 'video', 'text', 'quiz', 'assignment'
    video_url TEXT,
    duration_minutes INTEGER,
    order_index INTEGER DEFAULT 0,
    is_free BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES lms_courses(id) ON DELETE CASCADE
);

-- LMS Enrollments Table
CREATE TABLE IF NOT EXISTS lms_enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    progress INTEGER DEFAULT 0, -- 0-100
    completed_at DATETIME,
    status TEXT DEFAULT 'active', -- 'active', 'completed', 'dropped'
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES lms_courses(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(course_id, student_id)
);

-- LMS Lesson Progress Table
CREATE TABLE IF NOT EXISTS lms_lesson_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    enrollment_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL,
    completed BOOLEAN DEFAULT 0,
    progress_percentage INTEGER DEFAULT 0,
    time_spent_minutes INTEGER DEFAULT 0,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (enrollment_id) REFERENCES lms_enrollments(id) ON DELETE CASCADE,
    FOREIGN KEY (lesson_id) REFERENCES lms_lessons(id) ON DELETE CASCADE,
    UNIQUE(enrollment_id, lesson_id)
);

-- LMS Quizzes Table
CREATE TABLE IF NOT EXISTS lms_quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    course_id INTEGER,
    lesson_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    passing_score INTEGER DEFAULT 70,
    time_limit_minutes INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES lms_courses(id) ON DELETE CASCADE,
    FOREIGN KEY (lesson_id) REFERENCES lms_lessons(id) ON DELETE CASCADE
);

-- LMS Quiz Questions Table
CREATE TABLE IF NOT EXISTS lms_quiz_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    quiz_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT DEFAULT 'multiple_choice', -- 'multiple_choice', 'true_false', 'short_answer'
    options TEXT, -- JSON array for multiple choice
    correct_answer TEXT,
    points INTEGER DEFAULT 1,
    order_index INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (quiz_id) REFERENCES lms_quizzes(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lms_courses_tenant ON lms_courses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lms_courses_instructor ON lms_courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_lms_lessons_course ON lms_lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_lms_enrollments_tenant ON lms_enrollments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lms_enrollments_course ON lms_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_lms_enrollments_student ON lms_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_lms_lesson_progress_enrollment ON lms_lesson_progress(enrollment_id);
