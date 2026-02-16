-- Calendar Events Table
CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER, -- Created by
    title TEXT NOT NULL,
    description TEXT,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    all_day BOOLEAN DEFAULT 0,
    location TEXT,
    event_type TEXT DEFAULT 'event', -- 'event', 'appointment', 'meeting', 'reminder', 'holiday'
    status TEXT DEFAULT 'scheduled', -- 'scheduled', 'confirmed', 'cancelled', 'completed'
    color TEXT DEFAULT '#3b82f6', -- Hex color for calendar display
    attendees TEXT, -- JSON array of user_ids or emails
    reminder_minutes INTEGER, -- Minutes before event to send reminder (null = no reminder)
    recurrence_rule TEXT, -- RRULE format for recurring events
    parent_event_id INTEGER, -- For recurring event instances
    category TEXT,
    tags TEXT, -- JSON array or comma-separated
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_event_id) REFERENCES calendar_events(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant ON calendar_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_date ON calendar_events(start_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_end_date ON calendar_events(end_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(event_type);
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status);
CREATE INDEX IF NOT EXISTS idx_calendar_events_parent ON calendar_events(parent_event_id);
