"use client";

import { useEffect, useState } from "react";

const opening =
  "ამაოება ამაოებათა, ყოველივე ამაოა, ყველაფერი უკიდურესად წარმავალია,";
const question = "რა რჩება მაშინ, როცა ყველაფერი გადის?";

export function DecodeQuote() {
  const [text, setText] = useState("");
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const timers: number[] = [];
    let stopped = false;
    const later = (callback: () => void, delay: number) => {
      const timer = window.setTimeout(() => !stopped && callback(), delay);
      timers.push(timer);
    };
    const type = (value: string, index: number, done: () => void) => {
      setText(value.slice(0, index));
      if (index > value.length) return done();
      later(() => type(value, index + 1, done), 110);
    };
    const erase = (value: string, index: number, done: () => void) => {
      setText(value.slice(0, index));
      if (index < 0) return done();
      later(() => erase(value, index - 1, done), 52);
    };
    const run = () => {
      setFading(false);
      type(opening, 1, () => {
        later(() => erase(opening, opening.length - 1, () => {
          later(() => type(question, 1, () => {
            later(() => {
              setFading(true);
              later(() => {
                setText("");
                run();
              }, 700);
            }, 5000);
          }), 450);
        }), 900);
      });
    };
    later(run, 450);
    return () => {
      stopped = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return (
    <div className={`decode-quote ${fading ? "decode-fade" : ""}`} aria-label={`${opening} ${question}`}>
      <span className="decode-line">
        {text}
        {!fading && <span className="decode-caret" aria-hidden="true" />}
      </span>
    </div>
  );
}
