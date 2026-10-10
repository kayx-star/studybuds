"use client";

import { leaveGroup } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export function LeaveGroupButton({
  groupId,
  label,
  pending,
  confirmText,
}: {
  groupId: string;
  label: string;
  pending: string;
  confirmText: string;
}) {
  return (
    <form
      action={leaveGroup}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <input type="hidden" name="groupId" value={groupId} />
      <SubmitButton pending={pending} variant="ghost">
        <span className="text-red-600">{label}</span>
      </SubmitButton>
    </form>
  );
}
