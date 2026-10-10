"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pending }: { children: React.ReactNode; pending: string }) {
  const status = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={status.pending}>
      {status.pending ? pending : children}
    </button>
  );
}
