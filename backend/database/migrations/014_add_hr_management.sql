-- HR Employees Table
CREATE TABLE IF NOT EXISTS hr_employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER, -- Link to users table
    employee_id TEXT UNIQUE, -- Employee ID/Number
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    department TEXT,
    position TEXT,
    job_title TEXT,
    hire_date DATE,
    employment_type TEXT DEFAULT 'full_time', -- 'full_time', 'part_time', 'contract', 'intern'
    status TEXT DEFAULT 'active', -- 'active', 'on_leave', 'terminated', 'resigned'
    salary REAL,
    manager_id INTEGER, -- Self-referencing for hierarchy
    address TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (manager_id) REFERENCES hr_employees(id) ON DELETE SET NULL
);

-- HR Attendance Table
CREATE TABLE IF NOT EXISTS hr_attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    date DATE NOT NULL,
    check_in_time DATETIME,
    check_out_time DATETIME,
    break_duration_minutes INTEGER DEFAULT 0,
    total_hours REAL,
    status TEXT DEFAULT 'present', -- 'present', 'absent', 'late', 'half_day', 'leave'
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES hr_employees(id) ON DELETE CASCADE,
    UNIQUE(employee_id, date)
);

-- HR Leave Requests Table
CREATE TABLE IF NOT EXISTS hr_leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    leave_type TEXT NOT NULL, -- 'vacation', 'sick', 'personal', 'maternity', 'paternity', 'unpaid'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_requested INTEGER,
    reason TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'cancelled'
    approved_by INTEGER,
    approved_at DATETIME,
    rejection_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES hr_employees(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- HR Payroll Table
CREATE TABLE IF NOT EXISTS hr_payroll (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    pay_period_start DATE NOT NULL,
    pay_period_end DATE NOT NULL,
    base_salary REAL,
    overtime_hours REAL DEFAULT 0,
    overtime_pay REAL DEFAULT 0,
    bonuses REAL DEFAULT 0,
    deductions REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    net_pay REAL,
    status TEXT DEFAULT 'pending', -- 'pending', 'processed', 'paid'
    payment_date DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES hr_employees(id) ON DELETE CASCADE
);

-- HR Departments Table
CREATE TABLE IF NOT EXISTS hr_departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    manager_id INTEGER,
    budget REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (manager_id) REFERENCES hr_employees(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hr_employees_tenant ON hr_employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_user ON hr_employees(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_department ON hr_employees(department);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_tenant ON hr_attendance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_employee ON hr_attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_date ON hr_attendance(date);
CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_employee ON hr_leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_payroll_employee ON hr_payroll(employee_id);
