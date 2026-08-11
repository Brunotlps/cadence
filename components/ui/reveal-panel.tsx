"use client";

import { useId, useState, type ReactNode } from "react";

export function RevealPanel({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
      </button>
      <div id={panelId} hidden={!open}>
        {open && children}
      </div>
    </div>
  );
}
