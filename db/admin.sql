-- Admin layer: is_admin helper, member/role management, pin/unpin, moderation deletes,
-- and the #Success badge request/approval queue. All admin actions go through
-- security-definer RPCs guarded by is_admin() (no extra RLS policies needed).
-- Run in Supabase.

-- ---------------------------------------------------------------------------
-- BOOTSTRAP the first Super Admin (role changes need an existing admin).
-- Run once; safe to re-run.
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'basilambrosestevenson.bca24@ifheindia.org');

-- ---------------------------------------------------------------------------
-- Helper: is the caller a Super Admin? (security definer dodges profiles RLS)
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Members list (profiles RLS is read-own, so admins list members via RPC).
drop function if exists public.admin_members();
create function public.admin_members()
returns table (id uuid, email text, name text, role text, startup text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select p.id, u.email::text, p.name, p.role, p.startup, p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_admin()
  order by p.created_at
$$;
grant execute on function public.admin_members() to authenticated;

-- Assign a role (student / mentor / admin). Admins cannot change their own role
-- (prevents accidentally locking yourself out of the panel).
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_role not in ('student', 'mentor', 'admin') then raise exception 'invalid role'; end if;
  if p_user = auth.uid() then raise exception 'cannot change your own role'; end if;
  update public.profiles set role = p_role where id = p_user;
end
$$;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Pin / unpin a post (FRD B7): pinned posts sit on top of the feed.
create or replace function public.admin_pin_post(p_id uuid, p_pinned boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  update public.posts set pinned = p_pinned where id = p_id;
end
$$;
grant execute on function public.admin_pin_post(uuid, boolean) to authenticated;

-- Moderation deletes: any post / any comment.
create or replace function public.admin_delete_post(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  delete from public.posts where id = p_id;
end
$$;
grant execute on function public.admin_delete_post(uuid) to authenticated;

create or replace function public.admin_delete_comment(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  delete from public.comments where id = p_id;
end
$$;
grant execute on function public.admin_delete_comment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- #Success badge (FRD D4 + Module H): author requests, Super Admin approves.
-- posts.success_request: null | 'pending' | 'approved' | 'rejected'

-- Author asks for the badge on their own published post.
create or replace function public.request_success(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_post public.posts;
begin
  select * into v_post from public.posts where id = p_id;
  if not found then raise exception 'post not found'; end if;
  if v_post.author_id <> auth.uid() then raise exception 'not your post'; end if;
  if v_post.status <> 'published' then raise exception 'publish the post first'; end if;
  if v_post.success_request = 'approved' or 'Success' = any(coalesce(v_post.badges, '{}')) then
    raise exception 'already approved';
  end if;
  update public.posts set success_request = 'pending' where id = p_id;
end
$$;
grant execute on function public.request_success(uuid) to authenticated;

-- Admin queue: pending #Success requests.
drop function if exists public.admin_success_queue();
create function public.admin_success_queue()
returns table (id uuid, title text, author_name text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select p.id, p.title, a.name, p.created_at
  from public.posts p
  join public.profiles a on a.id = p.author_id
  where public.is_admin() and p.success_request = 'pending'
  order by p.created_at
$$;
grant execute on function public.admin_success_queue() to authenticated;

-- Approve: badge lands on the post. Reject: request cleared.
create or replace function public.admin_review_success(p_id uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_approve then
    update public.posts set
      success_request = 'approved',
      badges = case when 'Success' = any(coalesce(badges, '{}')) then badges
                    else array_append(coalesce(badges, '{}'), 'Success') end
    where id = p_id and success_request = 'pending';
  else
    update public.posts set success_request = 'rejected'
    where id = p_id and success_request = 'pending';
  end if;
end
$$;
grant execute on function public.admin_review_success(uuid, boolean) to authenticated;
