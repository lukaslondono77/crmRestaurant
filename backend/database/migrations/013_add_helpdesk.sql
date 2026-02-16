-- Help Desk Tickets Table
CREATE TABLE IF NOT EXISTS helpdesk_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    ticket_number TEXT UNIQUE NOT NULL,
    created_by INTEGER, -- User who created the ticket
    assigned_to INTEGER, -- Agent assigned to the ticket
    subject TEXT NOT NULL,
    description TEXT,
    category TEXT, -- 'technical', 'billing', 'support', 'feature_request', 'bug'
    priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    status TEXT DEFAULT 'open', -- 'open', 'in_progress', 'waiting', 'resolved', 'closed'
    source TEXT DEFAULT 'web', -- 'web', 'email', 'phone', 'chat'
    tags TEXT, -- JSON array
    resolution TEXT,
    resolved_at DATETIME,
    closed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

-- Help Desk Ticket Comments Table
CREATE TABLE IF NOT EXISTS helpdesk_ticket_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    ticket_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    comment TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT 0, -- Internal note vs customer-visible comment
    attachments TEXT, -- JSON array of file paths/IDs
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES helpdesk_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Help Desk Ticket Attachments Table
CREATE TABLE IF NOT EXISTS helpdesk_ticket_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    ticket_id INTEGER NOT NULL,
    comment_id INTEGER,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    uploaded_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES helpdesk_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES helpdesk_ticket_comments(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Help Desk Agents Table (tracks agent assignments and stats)
CREATE TABLE IF NOT EXISTS helpdesk_agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    department TEXT,
    is_active BOOLEAN DEFAULT 1,
    max_tickets INTEGER DEFAULT 10,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_tenant ON helpdesk_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_created_by ON helpdesk_tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_assigned_to ON helpdesk_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_status ON helpdesk_tickets(status);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_priority ON helpdesk_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_helpdesk_comments_ticket ON helpdesk_ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_agents_tenant ON helpdesk_agents(tenant_id);
