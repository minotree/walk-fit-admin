-- Run the audit first. This transaction preserves conflicting/legacy-only photos.
begin;
lock table public.exercise_sites, public.survey_locations in share row exclusive mode;

do $$
begin
  if exists (select 1 from public.exercise_sites where survey_location_id is not null
             group by survey_location_id having count(*) > 1)
     or exists (select 1 from public.survey_locations where linked_site_id is not null
                group by linked_site_id having count(*) > 1)
     or exists (select 1 from public.exercise_sites s join public.survey_locations q on q.id = s.survey_location_id
                where q.linked_site_id is not null and q.linked_site_id <> s.id)
     or exists (select 1 from public.survey_locations q join public.exercise_sites s on s.id = q.linked_site_id
                where s.survey_location_id is not null and s.survey_location_id <> q.id) then
    raise exception 'Conflicting survey/site links. Review audit-photo-relations.sql results first.';
  end if;
end $$;

-- Repair unambiguous one-way links. Keep both columns for compatibility with other clients.
update public.exercise_sites s set survey_location_id = q.id
from public.survey_locations q where q.linked_site_id = s.id and s.survey_location_id is null;
update public.survey_locations q set linked_site_id = s.id
from public.exercise_sites s where s.survey_location_id = q.id and q.linked_site_id is null;

-- Move legacy-only paths to their linked survey. Never replace an existing survey photo.
update public.survey_locations q set stamped_photo_path = s.site_image_path
from public.exercise_sites s
where s.survey_location_id = q.id and nullif(q.stamped_photo_path, '') is null
  and nullif(s.site_image_path, '') is not null;

-- Clear exact copies only. Different paths and sites without surveys are retained for review.
update public.exercise_sites s set site_image_path = null
from public.survey_locations q
where s.survey_location_id = q.id and s.site_image_path = q.stamped_photo_path
  and nullif(q.stamped_photo_path, '') is not null;

create unique index if not exists exercise_sites_one_representative_survey
  on public.exercise_sites (survey_location_id) where survey_location_id is not null;
create unique index if not exists survey_locations_one_linked_site
  on public.survey_locations (linked_site_id) where linked_site_id is not null;

-- Invoker security preserves existing RLS. A failed step rolls back the entire RPC.
create or replace function public.admin_approve_survey_to_site(p_survey_id uuid)
returns public.exercise_sites
language plpgsql security invoker set search_path = ''
as $$
declare
  survey public.survey_locations%rowtype;
  site public.exercise_sites%rowtype;
  changed_id uuid;
begin
  if not coalesce(public.admin_is_owner(), false) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  select * into survey from public.survey_locations where id = p_survey_id for update;
  if not found then raise exception 'Survey not found or access denied'; end if;
  if survey.status = 'rejected' then raise exception 'Rejected surveys cannot be approved'; end if;

  select * into site from public.exercise_sites where survey_location_id = survey.id for update;
  if not found and survey.linked_site_id is not null then
    select * into site from public.exercise_sites where id = survey.linked_site_id for update;
    if not found then raise exception 'Linked site not found or access denied'; end if;
    if site.survey_location_id is not null and site.survey_location_id <> survey.id then
      raise exception 'Site is linked to another survey';
    end if;
    update public.exercise_sites set survey_location_id = survey.id
      where id = site.id returning * into site;
    if not found then raise exception 'Site link update denied'; end if;
  end if;

  if site.id is null then
    if survey.status = 'approved' then raise exception 'Approved survey has no site; repair its link first'; end if;
    insert into public.exercise_sites
      (name, latitude, longitude, address_text, amenity_note, survey_location_id, is_published, last_verified_at)
    values (coalesce(nullif(btrim(survey.facility_name), ''), nullif(btrim(survey.address), ''), '신규 수집 지점'),
      survey.latitude, survey.longitude, coalesce(survey.address, ''), coalesce(survey.review_note, ''),
      survey.id, false, (current_timestamp at time zone 'Asia/Seoul')::date)
    returning * into site;
  end if;

  if survey.linked_site_id is not null and survey.linked_site_id <> site.id then
    raise exception 'Survey/site links disagree';
  end if;
  update public.survey_locations set status = 'approved', linked_site_id = site.id
    where id = survey.id returning id into changed_id;
  if changed_id is null then raise exception 'Survey approval update denied'; end if;
  return site;
end $$;

revoke all on function public.admin_approve_survey_to_site(uuid) from public, anon;
grant execute on function public.admin_approve_survey_to_site(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
