"use client";

import { useEffect, useState } from "react";

const quote = "ამაოება ამაოებათა, ყოველივე ამაოა";
const subline = "ყველაფერი უკიდურესად წარმავალია";

export function OverviewQuote() {
  const [text, setText] = useState("");

  useEffect(() => {
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setText(quote.slice(0, index));
      if (index >= quote.length) window.clearInterval(timer);
    }, 62);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="quote-banner overflow-hidden py-1">
      <p className="quote-motion max-w-3xl text-lg font-medium leading-[1.6] tracking-[-.02em] text-foreground sm:text-xl">
        {text}
        <span className="quote-caret ml-1 inline-block h-6 w-px translate-y-1 bg-brand sm:h-7" aria-hidden="true" />
      </p>
      <p className="mt-1 text-xs tracking-wide text-muted">{subline}</p>
    </div>
  );
}
