"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main
      id="main"
      className="flex min-h-[70vh] flex-col items-center justify-center gap-5 p-4 text-center"
    >
      <h1 className="text-xl font-medium">
        მონაცემების ჩატვირთვა ვერ მოხერხდა
      </h1>
      <p className="text-sm text-base-content/60">
        სცადეთ ხელახლა. თუ პრობლემა გაგრძელდა, დაუკავშირდით ადმინისტრატორს.
      </p>
      <button className="btn btn-primary " onClick={reset}>
        ხელახლა ცდა
      </button>
    </main>
  );
}
