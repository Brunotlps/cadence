import { FeedbackState } from "@/components/ui/feedback-state";
import styles from "./workspace-state.module.css";

export default function WorkspaceLoading() {
  return (
    <main className={styles.page}>
      <FeedbackState kind="loading" title="Carregando esta área…" />
    </main>
  );
}
