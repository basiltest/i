-- Feed querying: full-text search index, the feed_posts RPC (sort/search/tag/pagination +
-- score + the viewer's vote + tags, masking anonymous authors), and trending_tags. Run in Supabase.

-- Full-text search vector over the post text, with a GIN index so search scales.
alter table public.posts
  add column if not exists search_vec tsvector
  generated always as (
    to_tsvector('english',
      coalesce(title, '') || ' ' || coalesce(problem, '') || ' ' ||
      coalesce(solution, '') || ' ' || coalesce(startup, ''))
  ) stored;
create index if not exists posts_search_idx on public.posts using gin (search_vec);

-- Drop any prior signatures so the new one is unambiguous.
drop function if exists public.feed_posts(text);
drop function if exists public.feed_posts(text, text, text, text, int, int);

create function public.feed_posts(
  p_kind text default null,
  p_search text default null,
  p_tag text default null,
  p_sort text default 'new',
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid, kind text, title text, problem text, solution text, startup text,
  anonymous boolean, badges text[], success_request text, pinned boolean,
  edited boolean, created_at timestamptz,
  author_name text, author_role text, is_mine boolean,
  tags text[], score bigint, my_vote int
)
language sql stable security definer set search_path = public
as $$
  with me as (
    select auth.uid() as uid, (select role from public.profiles where id = auth.uid()) as role
  )
  select
    p.id, p.kind, p.title, p.problem, p.solution, p.startup,
    p.anonymous, p.badges, p.success_request, p.pinned, p.edited, p.created_at,
    case when p.anonymous and me.role is distinct from 'admin' and p.author_id <> me.uid then null else a.name end,
    case when p.anonymous and me.role is distinct from 'admin' and p.author_id <> me.uid then null else a.role end,
    (p.author_id = me.uid),
    coalesce((select array_agg(t.name order by t.name)
              from public.post_tags pt join public.tags t on t.id = pt.tag_id
              where pt.post_id = p.id and t.approved), '{}'),
    coalesce((select sum(v.value) from public.post_votes v where v.post_id = p.id), 0),
    (select v.value from public.post_votes v where v.post_id = p.id and v.user_id = me.uid)
  from public.posts p
  join public.profiles a on a.id = p.author_id
  cross join me
  where p.status = 'published'
    and (p_kind is null or p.kind = p_kind)
    and (p_search is null or p_search = '' or p.search_vec @@ websearch_to_tsquery('english', p_search))
    and (p_tag is null or exists (
      select 1 from public.post_tags pt join public.tags t on t.id = pt.tag_id
      where pt.post_id = p.id and t.approved and t.name = lower(p_tag)))
  order by
    p.pinned desc,
    case when p_sort = 'top'
         then coalesce((select sum(v.value) from public.post_votes v where v.post_id = p.id), 0)
         end desc nulls last,
    p.created_at desc
  limit greatest(1, least(p_limit, 50))
  offset greatest(0, p_offset)
$$;
grant execute on function public.feed_posts(text, text, text, text, int, int) to authenticated;

-- trending_tags: top approved tags by published-post count over the last p_days days.
drop function if exists public.trending_tags(int, int);
create function public.trending_tags(p_days int default 7, p_limit int default 6)
returns table (name text, cnt bigint)
language sql stable security definer set search_path = public
as $$
  select t.name, count(*) as cnt
  from public.post_tags pt
  join public.tags t on t.id = pt.tag_id
  join public.posts p on p.id = pt.post_id
  where t.approved and p.status = 'published'
    and p.created_at > now() - make_interval(days => greatest(1, p_days))
  group by t.name
  order by cnt desc, t.name
  limit greatest(1, least(p_limit, 20))
$$;
grant execute on function public.trending_tags(int, int) to authenticated;
