-- Debug script to test RLS policy behavior
-- Run this against the test database to understand UUID formatting

-- Check current setting
SELECT current_setting('app.current_tenant', true) AS current_tenant;

-- Test setting a UUID
SELECT set_config('app.current_tenant', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', false);
SELECT current_setting('app.current_tenant', true) AS after_set;

-- Test UUID comparisons 
WITH test_uuid AS (
  SELECT 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid AS test_id
)
SELECT 
  test_id,
  test_id::text AS uuid_as_text,
  current_setting('app.current_tenant', true) AS session_var,
  test_id::text = current_setting('app.current_tenant', true) AS comparison_result
FROM test_uuid;

-- Reset
RESET app.current_tenant;