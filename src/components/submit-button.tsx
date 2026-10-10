"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pending,
  variant = "primary",
}: {
  children: React.ReactNode;
  pending: string;
  variant?: "primary" | "ghost";
}) {
  const status = useFormStatus();
  return (
    <button type="submit" className={variant === "primary" ? "btn" : "btn-ghost"} disabled={status.pending}>
      {status.pending ? pending : children}
    </button>
  );
}
