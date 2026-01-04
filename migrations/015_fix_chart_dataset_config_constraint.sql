-- Fix CHECK constraint on aggregation_operator to allow NULL for line charts
ALTER TABLE chart_dataset_config DROP CONSTRAINT IF EXISTS chart_dataset_config_aggregation_operator_check;
ALTER TABLE chart_dataset_config ADD CONSTRAINT chart_dataset_config_aggregation_operator_check
    CHECK (aggregation_operator IS NULL OR aggregation_operator IN ('SUM', 'COUNT'));
