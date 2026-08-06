ALTER TABLE "transactions" DROP CONSTRAINT "transactions_kind_category_check";--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_kind_category_check" CHECK ((
        ("transactions"."kind" = 'expense' and "transactions"."category" in (
          'alimentacao', 'aluguel', 'assinaturas', 'automoveis',
          'combustivel', 'condominio', 'internet', 'lazer', 'luz', 'saude'
        ))
        or ("transactions"."kind" = 'income' and "transactions"."category" = 'renda')
        or ("transactions"."kind" = 'contribution' and "transactions"."category" is null)
      ) is true);