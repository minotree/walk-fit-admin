-- Existing SELECT policies already cover both buckets.
-- Permit deletion only for the designated administrator, preserving existing policies.
begin;

drop policy if exists walkfit_admin_delete_replaced_images on storage.objects;
create policy walkfit_admin_delete_replaced_images
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('survey-photos', 'equipment-images')
  and (select public.admin_is_owner())
);

commit;
