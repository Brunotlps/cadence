"use client";

import { useId, useRef, type ComponentProps, type ReactNode } from "react";
import styles from "./confirm-dialog.module.css";

type ConfirmDialogProps = {
  triggerLabel: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  pending: boolean;
  error: string | null;
  formAction: ComponentProps<"form">["action"];
};

export function ConfirmDialog({
  triggerLabel,
  title,
  description,
  confirmLabel,
  pendingLabel,
  pending,
  error,
  formAction,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <button
        className={styles.trigger}
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        {triggerLabel}
      </button>
      <dialog
        className={styles.dialog}
        ref={dialogRef}
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>{title}</h2>
        <p>{description}</p>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button
            className={styles.cancel}
            type="button"
            disabled={pending}
            onClick={() => dialogRef.current?.close()}
          >
            Cancelar
          </button>
          <form action={formAction}>
            <button
              className={styles.confirm}
              type="submit"
              disabled={pending}
            >
              {pending ? pendingLabel : confirmLabel}
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
