"use client";

import { useActionState } from "react";
import {
  resendConfirmationAction,
  type ResendConfirmationState,
} from "@/lib/actions/auth";

const initialState: ResendConfirmationState = { message: null };

export default function ConfirmEmailPage() {
  const [state, formAction, pending] = useActionState(
    resendConfirmationAction,
    initialState,
  );

  return (
    <main>
      <h1>Confirme seu e-mail</h1>
      <p>
        Enviamos um link de confirmação para o e-mail informado no cadastro.
        Clique no link para ativar sua conta.
      </p>
      <form action={formAction}>
        <div>
          <label htmlFor="email">Não recebeu? Informe o e-mail pra reenviar</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <button type="submit" disabled={pending}>
          Reenviar e-mail
        </button>
        {state.message && <p role="status">{state.message}</p>}
      </form>
    </main>
  );
}
