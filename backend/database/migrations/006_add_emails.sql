-- Email Messages Table
CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER, -- Sent by / Owner
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    body_html TEXT,
    from_email TEXT NOT NULL,
    from_name TEXT,
    to_emails TEXT NOT NULL, -- JSON array or comma-separated
    cc_emails TEXT, -- JSON array or comma-separated
    bcc_emails TEXT, -- JSON array or comma-separated
    reply_to_email TEXT,
    folder TEXT DEFAULT 'inbox', -- 'inbox', 'sent', 'draft', 'trash', 'spam', 'archive'
    status TEXT DEFAULT 'unread', -- 'read', 'unread', 'starred', 'important'
    is_draft BOOLEAN DEFAULT 0,
    is_important BOOLEAN DEFAULT 0,
    is_starred BOOLEAN DEFAULT 0,
    has_attachments BOOLEAN DEFAULT 0,
    parent_email_id INTEGER, -- For replies/threads
    thread_id INTEGER, -- For email threads
    sent_at DATETIME,
    read_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_email_id) REFERENCES emails(id) ON DELETE SET NULL
);

-- Email Attachments Table
CREATE TABLE IF NOT EXISTS email_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    email_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_emails_tenant ON emails(tenant_id);
CREATE INDEX IF NOT EXISTS idx_emails_user ON emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_folder ON emails(folder);
CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_created ON emails(created_at);
CREATE INDEX IF NOT EXISTS idx_email_attachments_tenant ON email_attachments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_attachments_email ON email_attachments(email_id);
