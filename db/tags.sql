-- tags + post_tags + tag_requests, and create_post (atomic post + tags + drafts). Run in Supabase.

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,                -- stored lowercased
  approved boolean not null default false,  -- only approved tags are usable/trending
  created_at timestamptz not null default now()
);

create table if not exists public.post_tags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

create table if not exists public.tag_requests (
  id uuid primary key default gen_random_uuid(),
  tag text not null,
  post_id uuid references public.posts(id) on delete set null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.tags enable row level security;
alter table public.post_tags enable row level security;
alter table public.tag_requests enable row level security;

-- tags: authed users read approved tags (suggestions, trending). Writes via RPC / admin only.
create policy "tags read approved" on public.tags
  for select to authenticated using (approved);

-- post_tags: readable for joins. Writes happen via the create_post RPC (definer) only.
create policy "post_tags read" on public.post_tags
  for select to authenticated using (true);

-- tag_requests: an author can read their own requests (admin queue comes later).
create policy "tag_requests read own" on public.tag_requests
  for select to authenticated using (author_id = auth.uid());

-- Atomic create: insert the post, link tags; a brand-new tag is created unapproved and queued
-- as a pending tag_request for admin approval. security definer so it can write tags/post_tags.
create or replace function public.create_post(
  p_kind text,
  p_title text,
  p_problem text,
  p_solution text,
  p_startup text,
  p_anonymous boolean,
  p_status text,
  p_tags text[]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_post_id uuid;
  v_tag text;
  v_norm text;
  v_tag_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_kind not in ('idea', 'problem') then raise exception 'invalid kind'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'title required'; end if;
  if coalesce(trim(p_problem), '') = '' then raise exception 'problem required'; end if;

  insert into public.posts (author_id, kind, title, problem, solution, startup, anonymous, status)
  values (
    v_uid, p_kind, trim(p_title), trim(p_problem),
    case when p_kind = 'idea' then nullif(trim(coalesce(p_solution, '')), '') else null end,
    nullif(trim(coalesce(p_startup, '')), ''),
    coalesce(p_anonymous, false),
    case when p_status = 'draft' then 'draft' else 'published' end
  )
  returning id into v_post_id;

  if p_tags is not null then
    foreach v_tag in array p_tags loop
      v_norm := lower(trim(v_tag));
      if v_norm = '' then continue; end if;

      select id into v_tag_id from public.tags where name = v_norm;
      if v_tag_id is null then
        insert into public.tags (name, approved) values (v_norm, false)
          on conflict (name) do nothing;
        select id into v_tag_id from public.tags where name = v_norm;
        insert into public.tag_requests (tag, post_id, author_id, status)
          values (v_norm, v_post_id, v_uid, 'pending');
      end if;

      insert into public.post_tags (post_id, tag_id) values (v_post_id, v_tag_id)
        on conflict do nothing;
    end loop;
  end if;

  return v_post_id;
end
$$;

grant execute on function public.create_post(text, text, text, text, text, boolean, text, text[]) to authenticated;
