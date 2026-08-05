"use client";

import { useActionState } from "react";
import {
  requestPasswordResetAction,
  type RequestPasswordResetState,
} from "@/lib/actions/auth";

const initialState: RequestPasswordResetState = { message: null };

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(
    requestPasswordResetAction,
    initialState,
  );

  return (
    <main>
      <h1>Recuperar senha</h1>
      <form action={formAction}>
        <div>
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <button type="submit" disabled={pending}>
          Enviar
        </button>
        {state.message && <p role="status">{state.message}</p>}
      </form>
    </main>
  );
}
