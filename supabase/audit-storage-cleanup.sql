-- Read-only. Run this SELECT in the Supabase SQL Editor.
-- Table RLS permissions do not imply permissions for files in storage.objects.
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by cmd, policyname;
