-- Purchases (Invoices)
CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor TEXT NOT NULL,
    purchase_date DATE NOT NULL,
    invoice_number TEXT,
    total_amount REAL NOT NULL,
    image_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Purchase Items
CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    category TEXT,
    expiry_date DATE,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
);

-- Sales (POS Reports)
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_date DATE NOT NULL,
    total_sales REAL NOT NULL,
    total_transactions INTEGER,
    average_ticket REAL,
    report_period TEXT,
    image_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sales Items
CREATE TABLE IF NOT EXISTS sales_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

-- Waste Records
CREATE TABLE IF NOT EXISTS waste (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    cost_value REAL NOT NULL,
    waste_date DATE NOT NULL,
    reason TEXT,
    notes TEXT,
    image_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Inventory (Current Stock)
CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    unit_price REAL,
    category TEXT,
    last_purchase_date DATE,
    last_sale_date DATE,
    expiry_date DATE,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    tenant_id INTEGER,
    UNIQUE(tenant_id, item_name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(report_date);
CREATE INDEX IF NOT EXISTS idx_purchase_items_name ON purchase_items(item_name);
CREATE INDEX IF NOT EXISTS idx_sales_items_name ON sales_items(item_name);
