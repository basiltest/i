-- feed_posts: published posts joined with author name/role, masking anonymous authors.
-- security definer so it can read profiles regardless of profiles RLS; the masking is enforced
-- inside the query (real identity only for the author themselves or an admin). Run in Supabase.

create or replace function public.feed_posts(p_kind text default null)
returns table (
  id uuid,
  kind text,
  title text,
  problem text,
  solution text,
  startup text,
  anonymous boolean,
  badges text[],
  success_request text,
  pinned boolean,
  edited boolean,
  created_at timestamptz,
  author_name text,
  author_role text,
  is_mine boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as uid,
           (select role from public.profiles where id = auth.uid()) as role
  )
  select
    p.id, p.kind, p.title, p.problem, p.solution, p.startup,
    p.anonymous, p.badges, p.success_request, p.pinned, p.edited, p.created_at,
    case when p.anonymous and me.role is distinct from 'admin' and p.author_id <> me.uid
         then null else a.name end as author_name,
    case when p.anonymous and me.role is distinct from 'admin' and p.author_id <> me.uid
         then null else a.role end as author_role,
    (p.author_id = me.uid) as is_mine
  from public.posts p
  join public.profiles a on a.id = p.author_id
  cross join me
  where p.status = 'published'
    and (p_kind is null or p.kind = p_kind)
  order by p.pinned desc, p.created_at desc
$$;

grant execute on function public.feed_posts(text) to authenticated;
