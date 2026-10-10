import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { localePath } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { currentStudentId } from "@/lib/session";

async function Signup() {
  const { locale } = await getI18n();
  if (await currentStudentId()) redirect(localePath(locale, "/me"));
  return <AuthForm mode="signup" />;
}

export default function SignupPage() {
  return (
    <Suspense>
      <Signup />
    </Suspense>
  );
}
