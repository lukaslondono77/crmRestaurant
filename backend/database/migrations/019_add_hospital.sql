-- Hospital Patients Table
CREATE TABLE IF NOT EXISTS hospital_patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    patient_id TEXT UNIQUE, -- Patient ID/Number
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE,
    gender TEXT, -- 'male', 'female', 'other'
    phone TEXT,
    email TEXT,
    address TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    blood_type TEXT,
    allergies TEXT,
    medical_history TEXT,
    insurance_provider TEXT,
    insurance_number TEXT,
    status TEXT DEFAULT 'active', -- 'active', 'discharged', 'deceased'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Hospital Appointments Table
CREATE TABLE IF NOT EXISTS hospital_appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    patient_id INTEGER NOT NULL,
    doctor_id INTEGER, -- User ID of doctor
    appointment_date DATETIME NOT NULL,
    appointment_type TEXT, -- 'consultation', 'follow_up', 'surgery', 'checkup'
    department TEXT,
    status TEXT DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled', 'no_show'
    notes TEXT,
    diagnosis TEXT,
    prescription TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES hospital_patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Hospital Admissions Table
CREATE TABLE IF NOT EXISTS hospital_admissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    patient_id INTEGER NOT NULL,
    admission_date DATETIME NOT NULL,
    discharge_date DATETIME,
    room_number TEXT,
    bed_number TEXT,
    department TEXT,
    diagnosis TEXT,
    doctor_id INTEGER, -- Primary doctor
    status TEXT DEFAULT 'admitted', -- 'admitted', 'discharged', 'transferred'
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES hospital_patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Hospital Medications Table
CREATE TABLE IF NOT EXISTS hospital_medications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    patient_id INTEGER NOT NULL,
    medication_name TEXT NOT NULL,
    dosage TEXT,
    frequency TEXT,
    start_date DATE,
    end_date DATE,
    prescribed_by INTEGER, -- Doctor ID
    status TEXT DEFAULT 'active', -- 'active', 'completed', 'discontinued'
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES hospital_patients(id) ON DELETE CASCADE,
    FOREIGN KEY (prescribed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Hospital Billing Table
CREATE TABLE IF NOT EXISTS hospital_billing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    patient_id INTEGER NOT NULL,
    admission_id INTEGER,
    appointment_id INTEGER,
    bill_date DATE DEFAULT CURRENT_DATE,
    total_amount REAL NOT NULL,
    paid_amount REAL DEFAULT 0,
    payment_status TEXT DEFAULT 'pending', -- 'pending', 'partial', 'paid', 'overdue'
    due_date DATE,
    payment_method TEXT,
    insurance_covered REAL DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES hospital_patients(id) ON DELETE CASCADE,
    FOREIGN KEY (admission_id) REFERENCES hospital_admissions(id) ON DELETE SET NULL,
    FOREIGN KEY (appointment_id) REFERENCES hospital_appointments(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hospital_patients_tenant ON hospital_patients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hospital_appointments_patient ON hospital_appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_hospital_appointments_doctor ON hospital_appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_hospital_appointments_date ON hospital_appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_hospital_admissions_patient ON hospital_admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_hospital_admissions_status ON hospital_admissions(status);
CREATE INDEX IF NOT EXISTS idx_hospital_medications_patient ON hospital_medications(patient_id);
CREATE INDEX IF NOT EXISTS idx_hospital_billing_patient ON hospital_billing(patient_id);
