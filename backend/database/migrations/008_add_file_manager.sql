-- File Manager - Folders Table
CREATE TABLE IF NOT EXISTS file_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER, -- Created by
    parent_folder_id INTEGER,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    is_archived BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_folder_id) REFERENCES file_folders(id) ON DELETE CASCADE
);

-- File Manager - Files Table
CREATE TABLE IF NOT EXISTS file_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    folder_id INTEGER,
    user_id INTEGER, -- Uploaded by
    file_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_type TEXT,
    mime_type TEXT,
    file_extension TEXT,
    is_starred BOOLEAN DEFAULT 0,
    is_archived BOOLEAN DEFAULT 0,
    is_shared BOOLEAN DEFAULT 0,
    tags TEXT, -- JSON array
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES file_folders(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- File Shares Table
CREATE TABLE IF NOT EXISTS file_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    file_id INTEGER,
    folder_id INTEGER,
    shared_by INTEGER,
    shared_with INTEGER, -- user_id
    permission TEXT DEFAULT 'view', -- 'view', 'edit', 'delete'
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES file_files(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES file_folders(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_with) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_file_folders_tenant ON file_folders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_file_folders_parent ON file_folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_file_files_tenant ON file_files(tenant_id);
CREATE INDEX IF NOT EXISTS idx_file_files_folder ON file_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_file_files_user ON file_files(user_id);
CREATE INDEX IF NOT EXISTS idx_file_shares_tenant ON file_shares(tenant_id);
CREATE INDEX IF NOT EXISTS idx_file_shares_file ON file_shares(file_id);
CREATE INDEX IF NOT EXISTS idx_file_shares_folder ON file_shares(folder_id);
