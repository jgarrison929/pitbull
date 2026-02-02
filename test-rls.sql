-- Test script to verify RLS is working
-- This should be run after the migration is applied

-- Create test tenants and projects
\echo 'Creating test data...'

INSERT INTO tenants (id, name, slug, created_at, created_by) VALUES 
('11111111-1111-1111-1111-111111111111', 'Tenant A', 'tenant-a', NOW(), 'test'),
('22222222-2222-2222-2222-222222222222', 'Tenant B', 'tenant-b', NOW(), 'test');

INSERT INTO projects (id, name, number, status, type, contract_amount, tenant_id, created_at, created_by) VALUES
('11111111-1111-1111-1111-111111111111', 'Project A1', 'PROJ-A1', 'Planning', 'Commercial', 100000.00, '11111111-1111-1111-1111-111111111111', NOW(), 'test'),
('22222222-2222-2222-2222-222222222222', 'Project A2', 'PROJ-A2', 'Active', 'Residential', 150000.00, '11111111-1111-1111-1111-111111111111', NOW(), 'test'),
('33333333-3333-3333-3333-333333333333', 'Project B1', 'PROJ-B1', 'Planning', 'Industrial', 200000.00, '22222222-2222-2222-2222-222222222222', NOW(), 'test'),
('44444444-4444-4444-4444-444444444444', 'Project B2', 'PROJ-B2', 'Completed', 'Commercial', 250000.00, '22222222-2222-2222-2222-222222222222', NOW(), 'test');

\echo 'Test data created.'
\echo ''

-- Test 1: Without setting tenant context - should see no rows (or all rows if superuser)
\echo 'Test 1: Query without tenant context (should see 0 rows for non-superusers):'
SELECT name, tenant_id FROM projects;
\echo ''

-- Test 2: Set tenant A context and query - should only see Tenant A projects
\echo 'Test 2: Set tenant A context and query (should see 2 projects):'
SET app.current_tenant = '11111111-1111-1111-1111-111111111111';
SELECT name, tenant_id FROM projects;
\echo ''

-- Test 3: Set tenant B context and query - should only see Tenant B projects
\echo 'Test 3: Set tenant B context and query (should see 2 projects):'
SET app.current_tenant = '22222222-2222-2222-2222-222222222222';
SELECT name, tenant_id FROM projects;
\echo ''

-- Test 4: Try to insert a project for different tenant - should fail
\echo 'Test 4: Try to insert project for different tenant (should fail):'
-- Still in Tenant B context, try to insert for Tenant A
INSERT INTO projects (id, name, number, status, type, contract_amount, tenant_id, created_at, created_by) VALUES
('99999999-9999-9999-9999-999999999999', 'Unauthorized Project', 'PROJ-FAIL', 'Planning', 'Commercial', 50000.00, '11111111-1111-1111-1111-111111111111', NOW(), 'test');
\echo ''

-- Test 5: Reset to no tenant context
\echo 'Test 5: Reset tenant context (should see 0 rows again):'
RESET app.current_tenant;
SELECT name, tenant_id FROM projects;
\echo ''

\echo 'RLS tests completed.'