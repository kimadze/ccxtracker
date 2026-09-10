import Link from "next/link";
export default function NotFound() { return <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-5 p-8 text-center"><p className="numeric text-6xl text-brand">404</p><h1 className="text-xl">გვერდი ვერ მოიძებნა</h1><Link href="/portfolios" className="button-primary">პორტფელზე დაბრუნება</Link></main>; }
