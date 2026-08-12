"use client";

import { useState } from "react";
import styles from "./auth-shell.module.css";

type PasswordFieldProps = {
  id: string;
  label: string;
  autoComplete: "current-password" | "new-password";
};

export function PasswordField({
  id,
  label,
  autoComplete,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.passwordControl}>
        <input
          id={id}
          name="password"
          type={visible ? "text" : "password"}
          required
          autoComplete={autoComplete}
        />
        <button
          type="button"
          aria-controls={id}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "Ocultar senha" : "Mostrar senha"}
        </button>
      </div>
    </div>
  );
}
