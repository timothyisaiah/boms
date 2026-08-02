grant usage on schema private to authenticated, service_role;

grant execute on function private.current_user_is_active()
to authenticated, service_role;

grant execute on function private.current_user_has_any_role(public.app_role[])
to authenticated, service_role;
