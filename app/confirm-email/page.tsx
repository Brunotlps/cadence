"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import {
  resendConfirmationAction,
  type ResendConfirmationState,
} from "@/lib/actions/auth";

const initialState: ResendConfirmationState = { message: null };

function ResendForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [state, formAction, pending] = useActionState(
    resendConfirmationAction,
    initialState,
  );

  return (
    <>
      <p>
        Enviamos um link de confirmação para {email || "o e-mail informado"}.
        Clique no link para ativar sua conta.
      </p>
      <form action={formAction}>
        <input type="hidden" name="email" value={email} />
        <button type="submit" disabled={pending || !email}>
          Reenviar e-mail
        </button>
        {state.message && <p role="status">{state.message}</p>}
      </form>
    </>
  );
}

export default function ConfirmEmailPage() {
  return (
    <main>
      <h1>Confirme seu e-mail</h1>
      <Suspense fallback={null}>
        <ResendForm />
      </Suspense>
    </main>
  );
}
