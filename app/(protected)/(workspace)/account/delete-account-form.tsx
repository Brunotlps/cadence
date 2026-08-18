"use client";

import { useActionState } from "react";
import {
  deleteOwnAccountAction,
  type DeleteOwnAccountActionState,
} from "@/lib/actions/account";
import formStyles from "@/components/ui/form-controls.module.css";
import styles from "./account.module.css";

const initialState: DeleteOwnAccountActionState = {
  error: null,
  fieldErrors: {},
  success: false,
};

export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState(
    deleteOwnAccountAction,
    initialState,
  );

  return (
    <form className={`${formStyles.form} ${styles.deleteForm}`} action={formAction}>
      <div className={formStyles.field}>
        <label htmlFor="delete-account-confirmation">
          Confirmação
        </label>
        <input
          id="delete-account-confirmation"
          name="confirmation"
          autoComplete="off"
          aria-invalid={Boolean(state.fieldErrors.confirmation)}
          aria-describedby={
            state.fieldErrors.confirmation
              ? "delete-account-confirmation-error"
              : undefined
          }
        />
        {state.fieldErrors.confirmation && (
          <p
            id="delete-account-confirmation-error"
            className={formStyles.fieldError}
          >
            {state.fieldErrors.confirmation}
          </p>
        )}
      </div>

      {state.error && (
        <p className={formStyles.formError} role="alert">
          {state.error}
        </p>
      )}

      <button className={styles.dangerButton} type="submit" disabled={pending}>
        {pending ? "Excluindo…" : "Excluir minha conta"}
      </button>
    </form>
  );
}
