"use client";

import { useEffect, useRef } from "react";

const message =
  "ამაოება ამაოებათა, ყოველივე ამაოა“ — ყველაფერი უკიდურესად წარმავალია. რა რჩება მაშინ, როცა ყველაფერი გადის?";
const alphabet = "აეიოუაბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ·—";

export function DecodeQuote() {
  const root = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let cancelled = false;
    const timers: number[] = [];

    const later = (callback: () => void, delay: number) => {
      const timer = window.setTimeout(callback, delay);
      timers.push(timer);
    };

    const run = () => {
      if (cancelled) return;
      node.replaceChildren(
        ...Array.from(message).map((character) => {
          const span = document.createElement("span");
          span.className = character === " " ? "decode-space" : "decode-char";
          span.dataset.target = character;
          span.textContent = character;
          return span;
        }),
      );
      const chars = Array.from(node.querySelectorAll<HTMLElement>(".decode-char"));
      chars.forEach((char, index) => {
        const lockDelay = 90 + index * 22;
        let cycles = 0;
        const scramble = () => {
          if (cancelled || cycles > 5) return;
          char.textContent = alphabet[Math.floor(Math.random() * alphabet.length)];
          cycles += 1;
          later(scramble, 35 + index * 3);
        };
        later(scramble, index * 18);
        later(() => {
          char.textContent = char.dataset.target ?? "";
          char.classList.add("decode-locked");
        }, lockDelay);
      });
      const dissolveAt = 1900 + message.length * 22;
      chars.forEach((char, index) => later(() => char.classList.add("decode-dissolve"), dissolveAt + index * 18));
      later(run, dissolveAt + message.length * 18 + 900);
    };

    run();
    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return <p ref={root} className="decode-quote" aria-label={message} />;
}
