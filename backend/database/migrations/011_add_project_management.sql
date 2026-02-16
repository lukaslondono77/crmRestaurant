-- Project Management Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER, -- Created by / Owner
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'planning', -- 'planning', 'active', 'on_hold', 'completed', 'cancelled'
    priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    start_date DATE,
    end_date DATE,
    budget REAL,
    spent REAL DEFAULT 0,
    progress INTEGER DEFAULT 0, -- 0-100
    color TEXT DEFAULT '#3b82f6',
    tags TEXT, -- JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Project Tasks Table
CREATE TABLE IF NOT EXISTS project_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    user_id INTEGER, -- Created by
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo', -- 'todo', 'in_progress', 'review', 'done'
    priority TEXT DEFAULT 'medium',
    assigned_to INTEGER,
    due_date DATE,
    estimated_hours REAL,
    actual_hours REAL,
    position INTEGER DEFAULT 0,
    parent_task_id INTEGER, -- For subtasks
    tags TEXT, -- JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_task_id) REFERENCES project_tasks(id) ON DELETE CASCADE
);

-- Project Team Members Table
CREATE TABLE IF NOT EXISTS project_team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member', -- 'owner', 'manager', 'member', 'viewer'
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(project_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_project_tasks_tenant ON project_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned ON project_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_project_team_tenant ON project_team_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_project_team_project ON project_team_members(project_id);
