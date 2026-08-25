CREATE TABLE "feedback_submission_limits" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "window_started_at" timestamp NOT NULL,
  "submission_count" integer NOT NULL,
  "expires_at" timestamp NOT NULL,
  CONSTRAINT "feedback_submission_limits_count_check"
    CHECK ("feedback_submission_limits"."submission_count" between 1 and 3),
  CONSTRAINT "feedback_submission_limits_expiry_check"
    CHECK (
      "feedback_submission_limits"."expires_at" =
        "feedback_submission_limits"."window_started_at" + interval '24 hours'
    )
);
--> statement-breakpoint
CREATE INDEX "feedback_submission_limits_expires_at_idx"
  ON "feedback_submission_limits" USING btree ("expires_at");
--> statement-breakpoint

-- Metadado estrito de controle por conta: não é dado de workspace e não recebe
-- acesso direto de papéis da aplicação. As duas funções abaixo são as únicas
-- fronteiras: aquisição autenticada e limpeza pelo scheduler do banco.
ALTER TABLE public.feedback_submission_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.feedback_submission_limits FROM PUBLIC;
REVOKE ALL ON TABLE public.feedback_submission_limits FROM anon;
REVOKE ALL ON TABLE public.feedback_submission_limits FROM authenticated;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.consume_feedback_submission_limit()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  slot_acquired boolean;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  INSERT INTO public.feedback_submission_limits (
    user_id,
    window_started_at,
    submission_count,
    expires_at
  ) VALUES (
    current_user_id,
    now(),
    1,
    now() + interval '24 hours'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    window_started_at = CASE
      WHEN feedback_submission_limits.expires_at <= now() THEN now()
      ELSE feedback_submission_limits.window_started_at
    END,
    submission_count = CASE
      WHEN feedback_submission_limits.expires_at <= now() THEN 1
      ELSE feedback_submission_limits.submission_count + 1
    END,
    expires_at = CASE
      WHEN feedback_submission_limits.expires_at <= now() THEN now() + interval '24 hours'
      ELSE feedback_submission_limits.expires_at
    END
  WHERE
    feedback_submission_limits.expires_at <= now()
    OR feedback_submission_limits.submission_count < 3
  RETURNING true INTO slot_acquired;

  RETURN COALESCE(slot_acquired, false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_feedback_submission_limit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_feedback_submission_limit() FROM anon;
GRANT EXECUTE ON FUNCTION public.consume_feedback_submission_limit() TO authenticated;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.cleanup_expired_feedback_submission_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.feedback_submission_limits
  WHERE expires_at <= now();
$$;

-- A rotina permanece interna ao scheduler/administrador de banco: nenhum papel
-- de aplicação, inclusive service_role, recebe EXECUTE.
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_feedback_submission_limits() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_feedback_submission_limits() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_feedback_submission_limits() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_feedback_submission_limits() FROM service_role;
--> statement-breakpoint

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'cleanup_feedback_submission_limits_hourly'
  ) THEN
    PERFORM cron.schedule(
      'cleanup_feedback_submission_limits_hourly',
      '0 * * * *',
      'SELECT public.cleanup_expired_feedback_submission_limits()'
    );
  END IF;
END;
$$;
--> statement-breakpoint

-- A deleção de conta usa service-role apenas para iniciar a rotina de conta já
-- auditada; a função remove explicitamente este metadado antes de encerrar Auth.
CREATE OR REPLACE FUNCTION public.handle_account_deletion(target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.feedback_submission_limits WHERE user_id = target;

  DELETE FROM workspace_members WHERE user_id = target;

  DELETE FROM workspaces w
  WHERE NOT EXISTS (
    SELECT 1 FROM workspace_members m WHERE m.workspace_id = w.id
  );

  DELETE FROM profiles WHERE id = target;
END;
$$;
