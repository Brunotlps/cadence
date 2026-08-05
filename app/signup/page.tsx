"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpAction, type SignUpState } from "@/lib/actions/auth";

const initialState: SignUpState = { error: null };

export default function SignUpPage() {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);

  return (
    <main>
      <h1>Criar conta</h1>
      <form action={formAction}>
        <div>
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label htmlFor="password">Senha</label>
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
          Criar conta
        </button>
      </form>
      <p>
        Já tem conta? <Link href="/login">Entrar</Link>
      </p>
    </main>
  );
}
