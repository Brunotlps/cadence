ALTER TABLE "transactions" ADD COLUMN "payment_method" text;--> statement-breakpoint

-- Não reclassifica nem apaga silenciosamente lançamentos anteriores. Se houver
-- qualquer linha incompatível com o domínio fechado nesta etapa, a migration para
-- antes de instalar constraints e exige uma decisão explícita sobre esses dados.
do $$
begin
  if exists (
    select 1
    from public.transactions
    where kind not in ('expense', 'income', 'contribution')
       or not (amount > 0 and amount <> 'NaN'::numeric)
       or (
         (kind = 'expense' and category in (
           'alimentacao', 'aluguel', 'assinaturas', 'automoveis',
           'combustivel', 'condominio', 'internet', 'lazer', 'luz', 'saude'
         ))
         or (kind = 'income' and category = 'renda')
         or (kind = 'contribution' and category is null)
       ) is not true
       or (description is not null and char_length(description) > 200)
  ) then
    raise exception using
      errcode = '23514',
      message = 'existing transactions violate stage 06 integrity constraints';
  end if;
end;
$$;--> statement-breakpoint

CREATE INDEX "transactions_workspace_occurred_created_idx" ON "transactions" USING btree ("workspace_id","occurred_on" DESC NULLS LAST,"created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_kind_check" CHECK ("transactions"."kind" in ('expense', 'income', 'contribution'));--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_positive_check" CHECK ("transactions"."amount" > 0 and "transactions"."amount" <> 'NaN'::numeric);--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_kind_category_check" CHECK ((
        ("transactions"."kind" = 'expense' and "transactions"."category" in (
          'alimentacao', 'aluguel', 'assinaturas', 'automoveis',
          'combustivel', 'condominio', 'internet', 'lazer', 'luz', 'saude'
        ))
        or ("transactions"."kind" = 'income' and "transactions"."category" = 'renda')
        or ("transactions"."kind" = 'contribution' and "transactions"."category" is null)
      ));--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payment_method_check" CHECK ("transactions"."payment_method" is null or "transactions"."payment_method" in (
        'pix', 'credit_card', 'debit_card', 'cash', 'boleto',
        'bank_transfer', 'other'
      ));--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_description_length_check" CHECK ("transactions"."description" is null or char_length("transactions"."description") <= 200);--> statement-breakpoint

-- A aplicação deriva created_by da sessão, mas isso não basta: o cliente anon é
-- público e um usuário autenticado pode chamar PostgREST diretamente. A policy
-- vincula a autoria ao JWT além de exigir membership no workspace.
drop policy if exists "transactions_insert_member" on public.transactions;--> statement-breakpoint

create policy "transactions_insert_member"
  on public.transactions for insert
  with check (
    public.is_workspace_member(workspace_id)
    and created_by = auth.uid()
  );--> statement-breakpoint

-- Membros continuam podendo editar campos de negócio de qualquer lançamento do
-- workspace (decisão da Etapa 04), mas ownership, autoria e timestamp de criação não
-- podem ser reescritos nem quando o usuário participa dos dois workspaces envolvidos.
create function public.protect_transaction_ownership_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '23514',
      message = 'transaction ownership fields are immutable';
  end if;

  return new;
end;
$$;--> statement-breakpoint

revoke execute on function public.protect_transaction_ownership_fields()
  from public, anon, authenticated;--> statement-breakpoint

create trigger protect_transaction_ownership_fields
  before update on public.transactions
  for each row
  execute function public.protect_transaction_ownership_fields();
