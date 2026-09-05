begin;

-- Existing databases may already have videos without this column.
alter table public.videos add column if not exists storage_path text not null default '';
create unique index if not exists videos_storage_path_idx on public.videos(storage_path) where storage_path <> '';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('screening-videos', 'screening-videos', false, 52428800, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- The backend grants time-limited upload/read URLs only after checking app sessions.
-- No anon/authenticated bucket policies are created.
notify pgrst, 'reload schema';
commit;
