"use client";

import { useEffect, useRef } from "react";

const lines = [
  "ამაოება ამაოებათა, ყოველივე ამაოა“ —",
  "ყველაფერი უკიდურესად წარმავალია",
  "რა რჩება მაშინ, როცა ყველაფერი გადის?",
];
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
      node.replaceChildren();
      const allChars: HTMLElement[] = [];
      let lineIndex = 0;

      const writeLine = () => {
        if (cancelled || lineIndex >= lines.length) {
          const hold = 1500;
          later(() => allChars.forEach((char, index) => {
            later(() => char.classList.add("decode-dissolve"), index * 14);
          }), hold);
          later(run, hold + allChars.length * 14 + 900);
          return;
        }

        const line = document.createElement("span");
        line.className = "decode-line";
        node.appendChild(line);
        const chars = Array.from(lines[lineIndex]).map((character) => {
          const span = document.createElement("span");
          span.className = character === " " ? "decode-space" : "decode-char";
          span.dataset.target = character;
          span.textContent = character;
          line.appendChild(span);
          if (character !== " ") allChars.push(span);
          return span;
        });

        chars.forEach((char, index) => {
          if (char.classList.contains("decode-space")) return;
          let cycles = 0;
          const scramble = () => {
            if (cancelled || cycles > 5) return;
            char.textContent = alphabet[Math.floor(Math.random() * alphabet.length)];
            cycles += 1;
            later(scramble, 34 + index * 2);
          };
          later(scramble, index * 16);
          later(() => {
            char.textContent = char.dataset.target ?? "";
            char.classList.add("decode-locked");
          }, 90 + index * 20);
        });

        lineIndex += 1;
        later(writeLine, 180 + chars.length * 20);
      };

      writeLine();
    };

    run();
    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return (
    <p ref={root} className="decode-quote" aria-label={lines.join(" ")}>
      {lines.map((line) => (
        <span className="decode-line decode-fallback" key={line}>
          {line}
        </span>
      ))}
    </p>
  );
}
