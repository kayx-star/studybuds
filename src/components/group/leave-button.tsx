"use client";

import { useState } from "react";
import { leaveGroup } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

/**
 * Leave group with an in-page two-step confirmation.
 * Avoids window.confirm because some embedded browsers block dialogs (treated as "Cancel"), making the button do nothing.
 */
export function LeaveGroupButton({
  groupId,
  label,
  pending,
  confirmText,
  confirmLabel,
  cancelLabel,
}: {
  groupId: string;
  label: string;
  pending: string;
  confirmText: string;
  confirmLabel: string;
  cancelLabel: string;
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button type="button" className="btn-ghost text-red-600" onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <form action={leaveGroup} className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-red-300 bg-red-500/5 px-3 py-2">
      <input type="hidden" name="groupId" value={groupId} />
      <span className="text-sm">{confirmText}</span>
      <button type="button" className="btn-ghost" onClick={() => setAsking(false)}>
        {cancelLabel}
      </button>
      <SubmitButton pending={pending}>{confirmLabel}</SubmitButton>
    </form>
  );
}
