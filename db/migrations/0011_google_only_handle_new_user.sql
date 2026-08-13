-- Custom SQL migration file, put your code below! --

-- Etapa 16: login passa a ser só Google. O Google preenche
-- raw_user_meta_data com `full_name` (padrão) ou `name` (fallback,
-- alguns fluxos OAuth só populam esse), nunca `display_name` — esse
-- último era exclusivo do formulário de cadastro por senha, que deixou
-- de existir. Sem coalesce, todo profile novo nasceria com
-- display_name nulo.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
