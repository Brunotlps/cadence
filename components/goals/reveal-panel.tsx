"use client";

import { useState, type ReactNode } from "react";

export function RevealPanel({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className={className}>
    <button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>{label}</button>
    {open && children}
  </div>;
}
