-- Adding a member by email only finds accounts whose email is confirmed. Otherwise someone could
-- sign up with a colleague's address before they do and be granted their access when an admin
-- adds that address. An unconfirmed account answers the same as no account, so this reveals
-- nothing about who has signed up.
create or replace function public.add_member_by_email(ws uuid, p_email text, p_role public.workspace_role)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  perform public.assert_can_assign(ws, p_role);

  select id into target from auth.users
  where lower(email) = lower(btrim(p_email)) and email_confirmed_at is not null;
  if target is null then
    raise exception 'No account uses that email' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.memberships where workspace_id = ws and user_id = target) then
    raise exception 'Already a member' using errcode = '23505';
  end if;

  insert into public.memberships (workspace_id, user_id, role) values (ws, target, p_role);
  return target;
end;
$$;
