-- Migration: Insert historical balance data for investment accounts

INSERT INTO entity_balance_history (entity_type, entity_id, entity_name_snapshot, balance, recorded_at) VALUES
('account', 36, 'TFSA', 13500, '2020-01-01'),
('account', 36, 'TFSA', 24500, '2021-01-01'),
('account', 36, 'TFSA', 34500, '2022-01-01'),
('account', 36, 'TFSA', 41000, '2023-01-01'),
('account', 36, 'TFSA', 48000, '2024-01-01'),
('account', 36, 'TFSA', 55000, '2025-01-01'),
('account', 36, 'TFSA', 62000, '2026-01-01'),
('account', 37, 'FHSA', 8000, '2023-01-01'),
('account', 37, 'FHSA', 16000, '2024-01-01'),
('account', 37, 'FHSA', 24000, '2025-01-01'),
('account', 37, 'FHSA', 32000, '2026-01-01'),
('account', 39, 'Non-Registered', 30000, '2023-01-01'),
('account', 39, 'Non-Registered', 30000, '2024-01-01'),
('account', 39, 'Non-Registered', 30000, '2025-01-01'),
('account', 39, 'Non-Registered', 30000, '2026-01-01'),
('account', 38, 'RRSP', 30000, '2024-01-01'),
('account', 38, 'RRSP', 68000, '2025-01-01'),
('account', 38, 'RRSP', 68000, '2026-01-01');
