import type { ElementType, ReactNode } from "react";
import styles from "./page-patterns.module.css";

type FeedbackStateProps = {
  kind: "empty" | "error" | "loading";
  title: string;
  description?: string;
  headingLevel?: 2 | 3;
  children?: ReactNode;
};

export function FeedbackState({
  kind,
  title,
  description,
  headingLevel = 2,
  children,
}: FeedbackStateProps) {
  const Heading = `h${headingLevel}` as ElementType;
  const liveProps =
    kind === "error"
      ? { role: "alert" as const }
      : kind === "loading"
        ? { role: "status" as const, "aria-live": "polite" as const }
        : {};

  return (
    <section
      className={`${styles.feedback} ${styles[kind]}`}
      data-feedback={kind}
      {...liveProps}
    >
      <Heading>{title}</Heading>
      {description && <p>{description}</p>}
      {children && <div className={styles.feedbackActions}>{children}</div>}
    </section>
  );
}
