-- Run manually if not using knex migrate:
-- ALTER TABLE ai_functions ADD COLUMN IF NOT EXISTS direction VARCHAR(20) NOT NULL DEFAULT 'both';

ALTER TABLE ai_functions
  ADD COLUMN IF NOT EXISTS direction VARCHAR(20) NOT NULL DEFAULT 'both';
