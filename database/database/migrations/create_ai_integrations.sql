-- ==========================================================
-- SQL to create ai_integrations table
-- ==========================================================

-- For MySQL:
CREATE TABLE IF NOT EXISTS `ai_integrations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT NULL,
  `provider` VARCHAR(100) NOT NULL DEFAULT 'opendental',
  `api_key` TEXT NOT NULL,
  `base_url` VARCHAR(255) NOT NULL DEFAULT 'https://api.opendental.com/api/v1',
  `extension` VARCHAR(100) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` INT NULL,
  `updated_by` INT NULL,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_ai_integrations_company` (`company_id`),
  INDEX `idx_ai_integrations_extension` (`extension`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- For PostgreSQL:
/*
CREATE TABLE IF NOT EXISTS ai_integrations (
  id SERIAL PRIMARY KEY,
  company_id INT NULL,
  provider VARCHAR(100) NOT NULL DEFAULT 'opendental',
  api_key TEXT NOT NULL,
  base_url VARCHAR(255) NOT NULL DEFAULT 'https://api.opendental.com/api/v1',
  extension VARCHAR(100) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_integrations_company ON ai_integrations (company_id);
CREATE INDEX IF NOT EXISTS idx_ai_integrations_extension ON ai_integrations (extension);
*/
