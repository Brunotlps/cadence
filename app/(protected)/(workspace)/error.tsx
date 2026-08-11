"use client";

import { FeedbackState } from "@/components/ui/feedback-state";
import styles from "./workspace-state.module.css";

export default function WorkspaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className={styles.page}>
      <FeedbackState
        kind="error"
        title="Não foi possível carregar esta área."
        description="Tente novamente. Se o problema continuar, volte pelo menu principal."
      >
        <button type="button" onClick={reset}>
          Tentar novamente
        </button>
      </FeedbackState>
    </main>
  );
}
