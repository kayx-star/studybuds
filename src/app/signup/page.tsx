import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { currentStudentId } from "@/lib/session";

async function Signup() {
  if (await currentStudentId()) redirect("/me");
  return <AuthForm mode="signup" />;
}

export default function SignupPage() {
  return (
    <Suspense>
      <Signup />
    </Suspense>
  );
}
