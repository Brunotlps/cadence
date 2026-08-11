"use client";

import { useActionState, useId, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const [selectedAccent, setSelectedAccent] = useState(initialAccent);
  const [state, formAction, pending] = useActionState(
    async (previousState: AccentColorActionState, formData: FormData) => {
      const result = await updateAccentColorAction(previousState, formData);
      if (result.success) setOpen(false);
      else setSelectedAccent(initialAccent);
      return result;
    },
    initialState,
  );
  const panelId = useId();
  const selectedLabel =
    ACCENT_COLORS.find((option) => option.value === selectedAccent)?.label ??
    "Verde";

  return (
    <div className={styles.accentPicker}>
      <button
        className={styles.appearanceTrigger}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className={styles.currentAccent}
          data-color={selectedAccent}
          aria-hidden="true"
        />
        <span>Aparência</span>
        <span className={styles.accentLabel}>: {selectedLabel}</span>
      </button>

      <div className={styles.accentPanel} id={panelId} hidden={!open}>
        <form className={styles.accentForm} action={formAction}>
          <fieldset disabled={pending}>
            <legend>Cor de destaque</legend>
            <div className={styles.accentOptions}>
              {ACCENT_COLORS.map((option) => (
                <label className={styles.accentOption} key={option.value}>
                  <input
                    checked={option.value === selectedAccent}
                    name="accentColor"
                    type="radio"
                    value={option.value}
                    onChange={(event) => {
                      setSelectedAccent(option.value);
                      event.currentTarget.form?.requestSubmit();
                    }}
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
          </fieldset>
          {pending && (
            <p className={styles.accentStatus} role="status">
              Atualizando…
            </p>
          )}
          {state.error && (
            <p className={styles.accentError} role="alert">
              {state.error}
            </p>
          )}
          {state.fieldErrors.accentColor && (
            <p className={styles.accentError} role="alert">
              {state.fieldErrors.accentColor}
            </p>
          )}
        </form>
      </div>

      {state.success && (
        <p className={styles.visuallyHidden} role="status">
          Cor atualizada.
        </p>
      )}
    </div>
  );
}
