-- Add task_id (display e.g. #951) and assigned_to_name (display override) for HTML-aligned To Do List
ALTER TABLE todos ADD COLUMN task_id VARCHAR(20);
ALTER TABLE todos ADD COLUMN assigned_to_name TEXT;
