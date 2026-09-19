-- The automatic-RLS event trigger is internal, never a client RPC.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
