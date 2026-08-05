-- Custom SQL migration file, put your code below! --

-- Postgres concede EXECUTE a PUBLIC por padrão em toda função nova, e o
-- PostgREST expõe qualquer função do schema public como RPC. A etapa 05 é o
-- primeiro momento em que create_workspace_with_owner passa a ser chamada de
-- fato pela aplicação em nome de um usuário real — fecha a observação de
-- hardening já registrada (não corrigida, não explorável) no findings log da
-- etapa 04: a função não precisa de EXECUTE para anon/PUBLIC, só para
-- authenticated (deriva o owner de auth.uid() internamente, então anon
-- nunca teria um uso legítimo dela).
revoke execute on function public.create_workspace_with_owner(text) from public;
revoke execute on function public.create_workspace_with_owner(text) from anon;
grant execute on function public.create_workspace_with_owner(text) to authenticated;