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
      className="grid min-h-dvh place-items-center bg-base-100 p-4"
    >
      <div className="card w-full max-w-md border border-base-300 bg-base-200">
        <div className="card-body gap-4 p-5">
          <Brand />
          <h1 className="text-xl font-semibold">შესვლა CCX-ში</h1>
          <p className="text-sm text-base-content/60">
            თქვენი პორტფელი და გეგმები ერთ სივრცეში.
          </p>
          {(!configured || error) && (
            <p role="status" className="alert alert-warning alert-soft text-xs">
              {!configured
                ? "პლატფორმა მომზადების ეტაპზეა. შესვლა სერვისების დაკავშირების შემდეგ გახდება ხელმისაწვდომი."
                : "შესვლა ვერ მოხერხდა. გადაამოწმეთ ანგარიშზე წვდომა და სცადეთ ხელახლა."}
            </p>
          )}
          <LoginButton enabled={configured} />
          <p className="mt-6 text-center text-[11px] leading-6 text-base-content/60">
            Google-ის პაროლი ამ პლატფორმაზე არ ინახება.
          </p>
          <Link href="/" className="link min-h-11 text-xs">
            მთავარ გვერდზე დაბრუნება →
          </Link>
        </div>
      </div>
    </main>
  );
}
