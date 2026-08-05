"use client";

import { useActionState } from "react";
import {
  updatePasswordAction,
  type UpdatePasswordState,
} from "@/lib/actions/auth";

const initialState: UpdatePasswordState = { error: null };

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(
    updatePasswordAction,
    initialState,
  );

  return (
    <main>
      <h1>Redefinir senha</h1>
      <form action={formAction}>
        <div>
          <label htmlFor="password">Nova senha</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
          />
        </div>
        {state.error && <p role="alert">{state.error}</p>}
        <button type="submit" disabled={pending}>
          Redefinir senha
        </button>
      </form>
    </main>
  );
}
