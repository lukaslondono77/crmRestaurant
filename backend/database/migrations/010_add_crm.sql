-- CRM Leads Table
CREATE TABLE IF NOT EXISTS crm_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER, -- Assigned to / Owner
    first_name TEXT NOT NULL,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    company TEXT,
    job_title TEXT,
    source TEXT, -- 'website', 'referral', 'social', 'email', 'phone', 'other'
    status TEXT DEFAULT 'new', -- 'new', 'contacted', 'qualified', 'converted', 'lost'
    priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
    estimated_value REAL,
    notes TEXT,
    tags TEXT, -- JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- CRM Deals Table
CREATE TABLE IF NOT EXISTS crm_deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    lead_id INTEGER,
    user_id INTEGER, -- Assigned to / Owner
    name TEXT NOT NULL,
    description TEXT,
    value REAL NOT NULL,
    stage TEXT DEFAULT 'prospecting', -- 'prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'
    probability INTEGER DEFAULT 0, -- 0-100
    expected_close_date DATE,
    actual_close_date DATE,
    notes TEXT,
    tags TEXT, -- JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- CRM Activities Table
CREATE TABLE IF NOT EXISTS crm_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER, -- Created by
    lead_id INTEGER,
    deal_id INTEGER,
    contact_id INTEGER,
    activity_type TEXT NOT NULL, -- 'call', 'email', 'meeting', 'note', 'task'
    subject TEXT NOT NULL,
    description TEXT,
    due_date DATETIME,
    completed_at DATETIME,
    is_completed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE,
    FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_leads_tenant ON crm_leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_user ON crm_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON crm_leads(status);
CREATE INDEX IF NOT EXISTS idx_crm_deals_tenant ON crm_deals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_user ON crm_deals(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_stage ON crm_deals(stage);
CREATE INDEX IF NOT EXISTS idx_crm_activities_tenant ON crm_activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_lead ON crm_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_deal ON crm_activities(deal_id);
