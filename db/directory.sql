-- Directory / Network (FRD Module K): browse + filter members. profiles RLS is read-own,
-- so the directory is exposed via a security-definer RPC. Phone is never exposed. Email is
-- returned ONLY for members who opted in (show_email). Members can opt out of the directory
-- entirely (directory_visible, on by default). Banned members are hidden. Run in Supabase.

-- directory preferences, both controlled by the user in Settings:
alter table public.profiles add column if not exists show_email boolean not null default false;
alter table public.profiles add column if not exists directory_visible boolean not null default true;

drop function if exists public.directory(text, text, text, text, text);
create function public.directory(
  p_search text default null,
  p_region text default null,
  p_sector text default null,
  p_domain text default null,
  p_role text default null
)
returns table (
  id uuid, name text, role text, startup text,
  region text, sector text, domain text, linkedin text, email text, bio text
)
language sql stable security definer set search_path = public
as $$
  select
    p.id, p.name, p.role, p.startup, p.region, p.sector, p.domain, p.linkedin,
    case when p.show_email then u.email::text else null end,
    p.bio
  from public.profiles p
  join auth.users u on u.id = p.id
  where coalesce(p.banned, false) = false
    and coalesce(p.directory_visible, true) = true
    and (p_role is null or p.role = p_role)
    and (p_region is null or p.region = p_region)
    and (p_sector is null or p.sector = p_sector)
    and (p_domain is null or p.domain = p_domain)
    and (p_search is null or p_search = ''
         or p.name ilike '%' || p_search || '%'
         or coalesce(p.startup, '') ilike '%' || p_search || '%')
  order by p.name
$$;
grant execute on function public.directory(text, text, text, text, text) to authenticated;
