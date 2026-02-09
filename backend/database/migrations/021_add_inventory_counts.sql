-- ============================================
-- WEEKLY INVENTORY COUNTS
-- ============================================
-- Snapshot of item quantities for a given week (count_date = week end).
-- Used for: Actual Food Cost = (Begin + Purchases - End) / Food Sales.
-- Beginning = previous week's ending; Ending = this week's count.

CREATE TABLE IF NOT EXISTS inventory_counts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    count_date DATE NOT NULL,
    item_name TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    unit_price REAL,
    category TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, count_date, item_name),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_inventory_counts_tenant_date 
ON inventory_counts(tenant_id, count_date);

CREATE INDEX IF NOT EXISTS idx_inventory_counts_tenant_item 
ON inventory_counts(tenant_id, item_name);
