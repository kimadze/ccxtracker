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
    <main id="main" className="mx-auto grid min-h-dvh max-w-6xl items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
      <div>
        <Brand />
        <p className="eyebrow mt-16">ინვესტორის სამუშაო სივრცე</p>
        <h1 className="mt-4 max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          სრული სურათი.<br /><span className="text-brand">მკაფიო გადაწყვეტილება.</span>
        </h1>
        <p className="mt-6 max-w-md text-sm leading-7 text-muted">
          აკონტროლეთ აქტივები, შეაფასეთ შედეგები და დაგეგმეთ შემდეგი ნაბიჯი — ერთ პირად სივრცეში.
        </p>
        <div className="mt-10 flex flex-wrap gap-3 text-xs text-muted">
          <span className="rounded-lg border border-line px-3 py-2">პორტფელის მონიტორინგი</span>
          <span className="rounded-lg border border-line px-3 py-2">შედეგების ანალიზი</span>
          <span className="rounded-lg border border-line px-3 py-2">სტრატეგიის დაგეგმვა</span>
        </div>
      </div>
      <div className="panel w-full max-w-md p-7 sm:p-9">
        <p className="eyebrow mb-4">პირადი სამუშაო სივრცე</p>
        <h2 className="text-2xl font-semibold">კეთილი იყოს თქვენი დაბრუნება</h2>
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
        <Link href="/" className="mt-7 inline-block text-xs text-brand">
          მთავარ გვერდზე დაბრუნება →
        </Link>
      </div>
    </main>
  );
}
