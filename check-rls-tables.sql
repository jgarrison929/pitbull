-- Check which tables have RLS enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    forcerowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
    AND (rowsecurity = true OR forcerowsecurity = true);

-- Check policies
SELECT schemaname, tablename, policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public';