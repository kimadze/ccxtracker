import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { LoginButton } from "@/components/auth-buttons";
import { getCurrentUser } from "@/server/auth";
import { isConfigured } from "@/server/config";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getCurrentUser()) redirect("/portfolios");
  const { error } = await searchParams;
  const configured = isConfigured();
  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center p-6"
    >
      <div className="mb-12">
        <Brand />
      </div>
      <div className="panel w-full max-w-md p-8 sm:p-10">
        <p className="eyebrow mb-4">პირადი სამუშაო სივრცე</p>
        <h1 className="text-2xl font-semibold">კეთილი იყოს თქვენი დაბრუნება</h1>
        <p className="mt-4 mb-8 text-sm leading-7 text-muted">
          შედით ანგარიშში და გააგრძელეთ თქვენი პორტფელის მართვა.
        </p>
        {(!configured || error) && (
          <p
            role="status"
            className="mb-5 rounded-lg border border-brand/20 bg-brand/5 p-3 text-xs leading-6 text-brand"
          >
            {!configured
              ? "პლატფორმა მომზადების ეტაპზეა. შესვლა სერვისების დაკავშირების შემდეგ გახდება ხელმისაწვდომი."
              : "შესვლა ვერ მოხერხდა. გადაამოწმეთ ანგარიშზე წვდომა და სცადეთ ხელახლა."}
          </p>
        )}
        <LoginButton enabled={configured} />
        <p className="mt-6 text-center text-[11px] leading-6 text-muted">
          Google-ის პაროლი ამ პლატფორმაზე არ ინახება.
        </p>
      </div>
      <Link href="/preview" className="mt-7 text-xs text-brand">
        სადემონსტრაციო სივრცის ნახვა →
      </Link>
    </main>
  );
}
