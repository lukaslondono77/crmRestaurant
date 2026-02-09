-- Events Table
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    created_by INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT DEFAULT 'event', -- 'event', 'conference', 'workshop', 'webinar', 'meeting'
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    location TEXT,
    venue_name TEXT,
    venue_address TEXT,
    is_online BOOLEAN DEFAULT 0,
    online_url TEXT,
    capacity INTEGER,
    price REAL DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    image_url TEXT,
    status TEXT DEFAULT 'draft', -- 'draft', 'published', 'cancelled', 'completed'
    registration_required BOOLEAN DEFAULT 0,
    registration_deadline DATE,
    tags TEXT, -- JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Event Registrations Table
CREATE TABLE IF NOT EXISTS event_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    user_id INTEGER, -- Registered user (if logged in)
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    company TEXT,
    job_title TEXT,
    registration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'registered', -- 'registered', 'confirmed', 'cancelled', 'attended', 'no_show'
    payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'refunded'
    payment_amount REAL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Event Speakers Table
CREATE TABLE IF NOT EXISTS event_speakers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    title TEXT,
    bio TEXT,
    company TEXT,
    image_url TEXT,
    social_links TEXT, -- JSON object
    order_index INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Event Sessions Table (for multi-session events)
CREATE TABLE IF NOT EXISTS event_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    location TEXT,
    speaker_id INTEGER, -- Link to event_speakers
    capacity INTEGER,
    order_index INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (speaker_id) REFERENCES event_speakers(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_user ON event_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_event_speakers_event ON event_speakers(event_id);
CREATE INDEX IF NOT EXISTS idx_event_sessions_event ON event_sessions(event_id);
