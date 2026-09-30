-- Add username column

alter table public.profiles
add column username text;

-- Backfill existing profiles before enforcing username constraints

do $$
declare
  existing_profile record;
  candidate_username text;
begin
  for existing_profile in
    select
      profile.id,
      auth_user.email,
      auth_user.raw_user_meta_data
    from public.profiles as profile
    left join auth.users as auth_user on auth_user.id = profile.id
    order by profile.created_at nulls first, profile.id
  loop
    candidate_username := pg_catalog.lower(
      pg_catalog.btrim(
        coalesce(
          nullif(
            pg_catalog.btrim(
              existing_profile.raw_user_meta_data ->> 'username'
            ),
            ''
          ),
          nullif(
            pg_catalog.btrim(
              pg_catalog.split_part(existing_profile.email, '@', 1)
            ),
            ''
          ),
          ''
        )
      )
    );

    if candidate_username !~ '^[a-z0-9._-]+$' then
      candidate_username := 'user_' || pg_catalog.replace(
        existing_profile.id::text,
        '-',
        ''
      );
    end if;

    while exists (
      select 1
      from public.profiles as profile
      where profile.username = candidate_username
        and profile.id <> existing_profile.id
    ) loop
      candidate_username := candidate_username || '_' || pg_catalog.replace(
        existing_profile.id::text,
        '-',
        ''
      );
    end loop;

    update public.profiles
    set username = candidate_username
    where id = existing_profile.id;
  end loop;
end;
$$;

-- Enforce username requirements

alter table public.profiles
alter column username set not null;

alter table public.profiles
add constraint profiles_username_key unique (username),
add constraint profiles_username_lowercase_check
  check (username = pg_catalog.lower(username)),
add constraint profiles_username_format_check
  check (username ~ '^[a-z0-9._-]+$');

-- Update the Auth user profile trigger

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_username text;
begin
  profile_username := pg_catalog.lower(
    pg_catalog.btrim(
      coalesce(
        nullif(
          pg_catalog.btrim(new.raw_user_meta_data ->> 'username'),
          ''
        ),
        nullif(
          pg_catalog.btrim(pg_catalog.split_part(new.email, '@', 1)),
          ''
        ),
        'user_' || pg_catalog.replace(new.id::text, '-', '')
      )
    )
  );

  insert into public.profiles (id, full_name, username, role)
  values (
    new.id,
    coalesce(
      nullif(
        pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'),
        ''
      ),
      nullif(pg_catalog.split_part(new.email, '@', 1), ''),
      'New User'
    ),
    profile_username,
    'staff'
  );

  return new;
end;
$$;

revoke all on function private.handle_new_user()
from public, anon, authenticated;
