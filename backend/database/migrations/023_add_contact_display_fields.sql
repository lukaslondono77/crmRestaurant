-- Add contact display fields aligned with contacts.html
ALTER TABLE contacts ADD COLUMN contact_id TEXT;
ALTER TABLE contacts ADD COLUMN lead_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN last_contacted DATE;
