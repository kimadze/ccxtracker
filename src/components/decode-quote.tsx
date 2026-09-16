"use client";

import { useEffect, useState } from "react";

const lines = [
  "ამაოება ამაოებათა, ყოველივე ამაოა“ —",
  "ყველაფერი უკიდურესად წარმავალია",
  "რა რჩება მაშინ, როცა ყველაფერი გადის?",
];

export function DecodeQuote() {
  const [written, setWritten] = useState(["", "", ""]);
  const [activeLine, setActiveLine] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let line = 0;
    let character = 0;
    let timer: number;
    let pause: number;

    const type = () => {
      if (line >= lines.length) {
        setFinished(true);
        pause = window.setTimeout(() => {
          setWritten(["", "", ""]);
          setActiveLine(0);
          setFinished(false);
          line = 0;
          character = 0;
          timer = window.setTimeout(type, 800);
        }, 3600);
        return;
      }
      setActiveLine(line);
      character += 1;
      const currentLine = line;
      setWritten((value) => {
        const next = [...value];
        next[currentLine] = lines[currentLine].slice(0, character);
        return next;
      });
      if (character >= lines[line].length) {
        line += 1;
        character = 0;
        timer = window.setTimeout(type, 1100);
      } else {
        timer = window.setTimeout(type, 125);
      }
    };

    timer = window.setTimeout(type, 650);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(pause);
    };
  }, []);

  return (
    <div className="decode-quote" aria-label={lines.join(" ")}>
      {lines.map((line, index) => (
        <span className="decode-line" key={line}>
          {written[index]}
          {activeLine === index && !finished && (
            <span className="decode-caret" aria-hidden="true" />
          )}
        </span>
      ))}
    </div>
  );
}
