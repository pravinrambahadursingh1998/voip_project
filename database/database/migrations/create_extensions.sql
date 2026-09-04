-- Optional: If you want to create an extensions table in MySQL
CREATE TABLE IF NOT EXISTS `extensions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT NULL,
  `extension` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) NULL,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_extensions_company` (`company_id`),
  INDEX `idx_extensions_ext` (`extension`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
