"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction, type SignInState } from "@/lib/actions/auth";

const initialState: SignInState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <main>
      <h1>Entrar</h1>
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
            autoComplete="current-password"
          />
        </div>
        {state.error && <p role="alert">{state.error}</p>}
        <button type="submit" disabled={pending}>
          Entrar
        </button>
      </form>
      <p>
        <Link href="/forgot-password">Esqueci minha senha</Link>
      </p>
      <p>
        Não tem conta? <Link href="/signup">Criar conta</Link>
      </p>
    </main>
  );
}
