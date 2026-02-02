-- Pitbull Construction Solutions - Database Initialization
-- This runs once when the PostgreSQL container is first created.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Row-Level Security helper: set current tenant
-- Application sets this per-connection via: SET app.current_tenant = '<uuid>'
-- RLS policies reference: current_setting('app.current_tenant')

-- Set a default to avoid errors when no tenant is set
ALTER DATABASE pitbull SET app.current_tenant = '00000000-0000-0000-0000-000000000000';

-- Log
DO $$ BEGIN RAISE NOTICE 'Pitbull database initialized successfully'; END $$;
