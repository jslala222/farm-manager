-- Add input_unit to processing_runs
ALTER TABLE processing_runs
ADD COLUMN input_unit TEXT NOT NULL DEFAULT 'kg';

ALTER TABLE processing_runs
ALTER COLUMN input_unit DROP DEFAULT;
