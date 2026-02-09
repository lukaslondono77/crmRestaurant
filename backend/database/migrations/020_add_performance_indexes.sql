-- ============================================
-- PERFORMANCE INDEXES
-- ============================================
-- These indexes dramatically improve query performance
-- Run this migration after Phase 1 fixes

-- Purchases table indexes
CREATE INDEX IF NOT EXISTS idx_purchases_tenant_date 
ON purchases(tenant_id, purchase_date);

CREATE INDEX IF NOT EXISTS idx_purchases_tenant 
ON purchases(tenant_id);

-- Purchase items indexes
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id 
ON purchase_items(purchase_id);

CREATE INDEX IF NOT EXISTS idx_purchase_items_tenant_name 
ON purchase_items(tenant_id, item_name);

-- Sales table indexes
CREATE INDEX IF NOT EXISTS idx_sales_tenant_date 
ON sales(tenant_id, report_date);

CREATE INDEX IF NOT EXISTS idx_sales_tenant 
ON sales(tenant_id);

-- Sales items indexes
CREATE INDEX IF NOT EXISTS idx_sales_items_sale_id 
ON sales_items(sale_id);

CREATE INDEX IF NOT EXISTS idx_sales_items_tenant_name 
ON sales_items(tenant_id, item_name);

-- Waste table indexes
CREATE INDEX IF NOT EXISTS idx_waste_tenant_date 
ON waste(tenant_id, waste_date);

CREATE INDEX IF NOT EXISTS idx_waste_tenant 
ON waste(tenant_id);

-- Inventory table indexes
CREATE INDEX IF NOT EXISTS idx_inventory_tenant_name 
ON inventory(tenant_id, item_name);

CREATE INDEX IF NOT EXISTS idx_inventory_tenant_category 
ON inventory(tenant_id, category);

-- Chat indexes (fixes N+1 problem)
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation 
ON chat_messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_participants_user 
ON chat_participants(user_id, conversation_id);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_tenant 
ON chat_conversations(tenant_id, updated_at DESC);

-- Events indexes
CREATE INDEX IF NOT EXISTS idx_events_tenant_dates 
ON events(tenant_id, start_date, end_date);

-- CRM indexes
CREATE INDEX IF NOT EXISTS idx_crm_leads_tenant_status 
ON crm_leads(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_crm_deals_tenant_stage 
ON crm_deals(tenant_id, stage);

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_tenant_active 
ON users(tenant_id, is_active);

-- Calendar indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant_date 
ON calendar_events(tenant_id, start_date);

-- Todo indexes
CREATE INDEX IF NOT EXISTS idx_todos_tenant_status 
ON todos(tenant_id, status);

-- Contact indexes
CREATE INDEX IF NOT EXISTS idx_contacts_tenant 
ON contacts(tenant_id);

-- Email indexes
CREATE INDEX IF NOT EXISTS idx_emails_tenant_date 
ON emails(tenant_id, sent_at);

-- Kanban indexes
CREATE INDEX IF NOT EXISTS idx_kanban_cards_list 
ON kanban_cards(column_id, position);

-- E-commerce indexes
CREATE INDEX IF NOT EXISTS idx_ecommerce_products_tenant 
ON ecommerce_products(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_ecommerce_orders_tenant_date 
ON ecommerce_orders(tenant_id, created_at);

-- Project Management indexes
CREATE INDEX IF NOT EXISTS idx_projects_tenant_status 
ON projects(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project 
ON project_tasks(project_id, status);

-- LMS indexes
CREATE INDEX IF NOT EXISTS idx_lms_courses_tenant 
ON lms_courses(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_lms_enrollments_student 
ON lms_enrollments(student_id, course_id);

-- Help Desk indexes
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_tenant_status 
ON helpdesk_tickets(tenant_id, status);

-- HR indexes
CREATE INDEX IF NOT EXISTS idx_hr_employees_tenant 
ON hr_employees(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_hr_attendance_employee_date 
ON hr_attendance(employee_id, date);

-- Social indexes
CREATE INDEX IF NOT EXISTS idx_social_posts_tenant_date 
ON social_posts(tenant_id, created_at DESC);

-- School indexes
CREATE INDEX IF NOT EXISTS idx_school_students_tenant_grade 
ON school_students(tenant_id, grade);

CREATE INDEX IF NOT EXISTS idx_school_enrollments_student_course 
ON school_enrollments(student_id, course_id);

-- Hospital indexes
CREATE INDEX IF NOT EXISTS idx_hospital_patients_tenant 
ON hospital_patients(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_hospital_appointments_patient_date 
ON hospital_appointments(patient_id, appointment_date);

-- Analyze tables to update statistics
ANALYZE;
