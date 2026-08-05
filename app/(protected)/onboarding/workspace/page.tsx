"use client";

import { useActionState } from "react";
import {
  createWorkspaceAction,
  type CreateWorkspaceState,
} from "@/lib/actions/workspace";

const initialState: CreateWorkspaceState = { error: null };

export default function CreateWorkspacePage() {
  const [state, formAction, pending] = useActionState(
    createWorkspaceAction,
    initialState,
  );

  return (
    <main>
      <h1>Crie seu espaço</h1>
      <p>Todas as transações e metas ficam dentro de um espaço compartilhável.</p>
      <form action={formAction}>
        <div>
          <label htmlFor="name">Nome do espaço</label>
          <input id="name" name="name" type="text" required />
        </div>
        {state.error && <p role="alert">{state.error}</p>}
        <button type="submit" disabled={pending}>
          Criar espaço
        </button>
      </form>
    </main>
  );
}
