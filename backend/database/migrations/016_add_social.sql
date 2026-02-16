-- Social Posts Table
CREATE TABLE IF NOT EXISTS social_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    post_type TEXT DEFAULT 'text', -- 'text', 'image', 'video', 'link', 'poll'
    media_urls TEXT, -- JSON array of media URLs
    link_url TEXT,
    link_title TEXT,
    link_description TEXT,
    link_image TEXT,
    poll_question TEXT,
    poll_options TEXT, -- JSON array
    poll_end_date DATETIME,
    is_published BOOLEAN DEFAULT 1,
    scheduled_at DATETIME,
    published_at DATETIME,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    tags TEXT, -- JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Social Post Likes Table
CREATE TABLE IF NOT EXISTS social_post_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES social_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(post_id, user_id)
);

-- Social Post Comments Table
CREATE TABLE IF NOT EXISTS social_post_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    parent_comment_id INTEGER, -- For nested comments/replies
    content TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES social_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES social_post_comments(id) ON DELETE CASCADE
);

-- Social Post Shares Table
CREATE TABLE IF NOT EXISTS social_post_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    shared_content TEXT, -- Optional comment when sharing
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES social_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Social Follows Table
CREATE TABLE IF NOT EXISTS social_follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    follower_id INTEGER NOT NULL,
    following_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(follower_id, following_id)
);

-- Social Notifications Table
CREATE TABLE IF NOT EXISTS social_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    notification_type TEXT NOT NULL, -- 'like', 'comment', 'share', 'follow', 'mention'
    related_user_id INTEGER,
    related_post_id INTEGER,
    related_comment_id INTEGER,
    message TEXT,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (related_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (related_post_id) REFERENCES social_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (related_comment_id) REFERENCES social_post_comments(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_social_posts_tenant ON social_posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_user ON social_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_published ON social_posts(is_published, published_at);
CREATE INDEX IF NOT EXISTS idx_social_post_likes_post ON social_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_social_post_comments_post ON social_post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_social_follows_follower ON social_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_social_follows_following ON social_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_social_notifications_user ON social_notifications(user_id, is_read);
