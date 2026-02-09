-- E-Commerce Products Table
CREATE TABLE IF NOT EXISTS ecommerce_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT UNIQUE,
    price REAL NOT NULL,
    compare_at_price REAL,
    cost_price REAL,
    stock_quantity INTEGER DEFAULT 0,
    track_inventory BOOLEAN DEFAULT 1,
    category_id INTEGER,
    status TEXT DEFAULT 'active', -- 'active', 'draft', 'archived'
    featured BOOLEAN DEFAULT 0,
    images TEXT, -- JSON array of image URLs
    tags TEXT, -- JSON array
    weight REAL,
    dimensions TEXT, -- JSON: {length, width, height}
    seo_title TEXT,
    seo_description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- E-Commerce Categories Table
CREATE TABLE IF NOT EXISTS ecommerce_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    parent_id INTEGER,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES ecommerce_categories(id) ON DELETE SET NULL
);

-- E-Commerce Orders Table
CREATE TABLE IF NOT EXISTS ecommerce_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    order_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    shipping_address TEXT, -- JSON
    billing_address TEXT, -- JSON
    subtotal REAL NOT NULL,
    tax_amount REAL DEFAULT 0,
    shipping_amount REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    total_amount REAL NOT NULL,
    payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'refunded', 'failed'
    fulfillment_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'shipped', 'delivered', 'cancelled'
    payment_method TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- E-Commerce Order Items Table
CREATE TABLE IF NOT EXISTS ecommerce_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    order_id INTEGER NOT NULL,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    product_sku TEXT,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES ecommerce_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES ecommerce_products(id) ON DELETE SET NULL
);

-- E-Commerce Cart Table (for guest carts)
CREATE TABLE IF NOT EXISTS ecommerce_carts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER, -- null for guest carts
    session_id TEXT, -- for guest carts
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- E-Commerce Cart Items Table
CREATE TABLE IF NOT EXISTS ecommerce_cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    cart_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (cart_id) REFERENCES ecommerce_carts(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES ecommerce_products(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ecommerce_products_tenant ON ecommerce_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ecommerce_products_category ON ecommerce_products(category_id);
CREATE INDEX IF NOT EXISTS idx_ecommerce_products_status ON ecommerce_products(status);
CREATE INDEX IF NOT EXISTS idx_ecommerce_categories_tenant ON ecommerce_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ecommerce_orders_tenant ON ecommerce_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ecommerce_orders_customer ON ecommerce_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_ecommerce_order_items_order ON ecommerce_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_ecommerce_carts_tenant ON ecommerce_carts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ecommerce_carts_user ON ecommerce_carts(user_id);
