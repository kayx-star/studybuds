"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/group-actions";

/** Form that shows error/success messages; use SubmitButton inside for the pending state */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error && <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">{state.ok}</p>}
      {state.link && (
        <a href={state.link} className="mt-2 block break-all rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-accent underline">
          {state.link}
        </a>
      )}
    </form>
  );
}
