import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { currentStudentId } from "@/lib/session";

async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await currentStudentId()) redirect("/me");
  return <AuthForm mode="login" next={next} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense>
      <Login searchParams={searchParams as Promise<{ next?: string }>} />
    </Suspense>
  );
}
