-- Read-only. Run before and after the migration in the Supabase SQL editor.
-- Expected: no duplicate/conflicting links. Legacy-only/conflicting photos need review.
select survey_location_id, count(*) as site_count
from public.exercise_sites where survey_location_id is not null
group by survey_location_id having count(*) > 1;

select linked_site_id, count(*) as survey_count
from public.survey_locations where linked_site_id is not null
group by linked_site_id having count(*) > 1;

select s.id as site_id, s.survey_location_id, q.id as survey_id, q.linked_site_id
from public.exercise_sites s
join public.survey_locations q on q.id = s.survey_location_id
where q.linked_site_id is not null and q.linked_site_id <> s.id;

select q.id as survey_id, q.linked_site_id, s.survey_location_id
from public.survey_locations q
join public.exercise_sites s on s.id = q.linked_site_id
where s.survey_location_id is not null and s.survey_location_id <> q.id;

select s.id as site_id, s.survey_location_id, s.site_image_path as legacy_path,
       q.stamped_photo_path as survey_path,
       case when q.id is null then 'missing_survey_link'
            when nullif(q.stamped_photo_path, '') is null then 'legacy_only_photo'
            when s.site_image_path = q.stamped_photo_path then 'duplicate_photo'
            else 'different_photo_paths' end as issue
from public.exercise_sites s
left join public.survey_locations q on q.id = s.survey_location_id
where nullif(s.site_image_path, '') is not null;

-- PWA and older clients may depend on these views/triggers/policies. Inspect before changing them.
select schemaname, viewname, definition from pg_views
where schemaname = 'public' and (definition ilike '%site_image_path%' or definition ilike '%stamped_photo_path%');
select trigger_name, event_object_table, action_statement from information_schema.triggers
where event_object_schema = 'public' and event_object_table in ('exercise_sites', 'survey_locations');
select tablename, policyname, roles, cmd, qual, with_check from pg_policies
where schemaname = 'public' and tablename in ('exercise_sites', 'survey_locations', 'equipment_catalog');
