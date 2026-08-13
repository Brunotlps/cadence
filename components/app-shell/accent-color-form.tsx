"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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

// Sem isso, cada passo de navegação por seta no radiogroup nativo submete e
// fecha o painel antes do usuário alcançar a opção pretendida (etapa 13).
const ACCENT_SUBMIT_DEBOUNCE_MS = 350;

export function AccentColorForm({
  initialAccent,
}: {
  initialAccent: AccentColor;
}) {
  const pathname = usePathname();
  const [openPathname, setOpenPathname] = useState<string | null>(null);
  const [selectedAccent, setSelectedAccent] = useState(initialAccent);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const open = openPathname === pathname;
  const [state, formAction, pending] = useActionState(
    async (previousState: AccentColorActionState, formData: FormData) => {
      const result = await updateAccentColorAction(previousState, formData);
      if (result.success) setOpenPathname(null);
      else setSelectedAccent(initialAccent);
      return result;
    },
    initialState,
  );
  const panelId = useId();
  const selectedLabel =
    ACCENT_COLORS.find((option) => option.value === selectedAccent)?.label ??
    "Verde";

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpenPathname(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpenPathname(null);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
    };
  }, []);

  return (
    <div className={styles.accentPicker} ref={containerRef}>
      <button
        className={styles.appearanceTrigger}
        type="button"
        ref={triggerRef}
        aria-label={`Aparência: ${selectedLabel}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() =>
          setOpenPathname((current) => (current === pathname ? null : pathname))
        }
      >
        <span
          className={styles.currentAccent}
          data-color={selectedAccent}
          aria-hidden="true"
        />
        <span className={styles.appearanceLabel}>Aparência</span>
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
                      const form = event.currentTarget.form;
                      if (submitTimeoutRef.current) {
                        clearTimeout(submitTimeoutRef.current);
                      }
                      submitTimeoutRef.current = setTimeout(() => {
                        form?.requestSubmit();
                      }, ACCENT_SUBMIT_DEBOUNCE_MS);
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
