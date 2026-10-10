import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { localePath } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { currentStudentId } from "@/lib/session";

async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, { locale }] = await Promise.all([searchParams, getI18n()]);
  if (await currentStudentId()) redirect(localePath(locale, "/me"));
  return <AuthForm mode="login" next={next} />;
}

export default function LoginPage({ searchParams }: PageProps<"/[lang]/login">) {
  return (
    <Suspense>
      <Login searchParams={searchParams as Promise<{ next?: string }>} />
    </Suspense>
  );
}
