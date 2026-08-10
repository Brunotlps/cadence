"use client";

import { useActionState } from "react";
import {
  updateAccentColorAction,
  type AccentColorActionState,
} from "@/lib/actions/profile";
import {
  ACCENT_COLORS,
  type AccentColor,
} from "@/lib/profiles/accent-colors";
import styles from "./app-shell.module.css";

const initialState: AccentColorActionState = {
  error: null,
  fieldErrors: {},
  success: false,
};

export function AccentColorForm({
  initialAccent,
}: {
  initialAccent: AccentColor;
}) {
  const [state, formAction, pending] = useActionState(
    updateAccentColorAction,
    initialState,
  );

  return (
    <form className={styles.accentForm} action={formAction}>
      <fieldset disabled={pending}>
        <legend>Cor de destaque</legend>
        <div className={styles.accentControls}>
          <div className={styles.accentOptions}>
            {ACCENT_COLORS.map((option) => (
              <label className={styles.accentOption} key={option.value}>
                <input
                  defaultChecked={option.value === initialAccent}
                  name="accentColor"
                  type="radio"
                  value={option.value}
                />
                <span
                  className={styles.accentSwatch}
                  data-color={option.value}
                  aria-hidden="true"
                />
                <span className={styles.accentLabel}>{option.label}</span>
              </label>
            ))}
          </div>
          <button className={styles.saveAccent} type="submit">
            {pending ? "Salvando…" : "Salvar cor"}
          </button>
        </div>
      </fieldset>
      {state.error && <p className={styles.accentError}>{state.error}</p>}
      {state.fieldErrors.accentColor && (
        <p className={styles.accentError}>{state.fieldErrors.accentColor}</p>
      )}
      {state.success && (
        <p className={styles.accentSuccess} role="status">
          Cor atualizada.
        </p>
      )}
    </form>
  );
}
