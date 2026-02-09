-- Tabla de empresas/tenants
CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL,
    subdomain TEXT UNIQUE,
    square_access_token TEXT,
    square_location_id TEXT,
    subscription_plan TEXT DEFAULT 'basic',
    subscription_status TEXT DEFAULT 'trial',
    trial_ends_at DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role TEXT DEFAULT 'manager', -- 'admin', 'manager', 'staff'
    is_active BOOLEAN DEFAULT 1,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, email)
);

-- Agregar tenant_id a todas las tablas existentes
-- Nota: SQLite no soporta ALTER TABLE ADD COLUMN si la columna ya existe
-- Usaremos una verificación condicional

-- Para purchases
-- Verificar si la columna existe antes de agregarla
-- Si no existe, se agregará en la migración

-- Para purchase_items
-- Similar a purchases

-- Para sales
-- Similar a purchases

-- Para sales_items
-- Similar a purchases

-- Para waste
-- Similar a purchases

-- Para inventory
-- Similar a purchases

-- Crear índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_purchases_tenant ON purchases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_tenant ON sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_waste_tenant ON waste(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tenant ON inventory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
