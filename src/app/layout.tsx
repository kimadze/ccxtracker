import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Crypto Collective X — პორტფელის მართვა",
    template: "%s · CCX",
  },
  description:
    "თქვენი კრიპტოპორტფელი ერთ სივრცეში — მონიტორინგი, ანალიტიკა და სტრატეგიის დაგეგმვა.",
  openGraph: {
    title: "Crypto Collective X",
    description: "გააზრებული გადაწყვეტილებები იწყება სრული სურათით.",
    locale: "ka_GE",
    type: "website",
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ka" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:`(function(){try{var t=localStorage.getItem('ccx-theme');if(t!=='dark'&&t!=='light')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}})()`}} /></head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:bg-raised focus:p-3"
        >
          შინაარსზე გადასვლა
        </a>
        {children}
      </body>
    </html>
  );
}
