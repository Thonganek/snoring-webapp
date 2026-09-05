begin;
alter table public.children add column if not exists deleted_at timestamptz;
alter table public.screenings add column if not exists deleted_at timestamptz;
alter table public.videos add column if not exists deleted_at timestamptz;

-- Archiving/restoring a child and all linked records is one database transaction.
create or replace function public.sync_child_trash() returns trigger language plpgsql
set search_path = public, pg_temp as $$
begin
  if new.deleted_at is distinct from old.deleted_at then
    update public.screenings set deleted_at = new.deleted_at where child_id = new.child_id;
    update public.videos set deleted_at = new.deleted_at where child_id = new.child_id;
  end if;
  return new;
end $$;
drop trigger if exists child_trash_cascade on public.children;
create trigger child_trash_cascade after update of deleted_at on public.children
for each row execute function public.sync_child_trash();

-- Serialize new assessments/uploads with archive operations on the parent child.
create or replace function public.require_active_child() returns trigger language plpgsql
set search_path = public, pg_temp as $$
begin
  if new.deleted_at is null then
    perform 1 from public.children where child_id = new.child_id and deleted_at is null for share;
    if not found then raise exception 'Child is missing or in trash'; end if;
  end if;
  return new;
end $$;
drop trigger if exists screening_active_child on public.screenings;
create trigger screening_active_child before insert or update on public.screenings
for each row execute function public.require_active_child();
drop trigger if exists video_active_child on public.videos;
create trigger video_active_child before insert or update on public.videos
for each row execute function public.require_active_child();
revoke all on function public.sync_child_trash(), public.require_active_child() from public, anon, authenticated;
grant execute on function public.sync_child_trash(), public.require_active_child() to service_role;
notify pgrst, 'reload schema';
commit;
