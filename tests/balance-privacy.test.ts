import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { BalanceValue } from "@/components/ui";
import {
  readPrivacy,
  serverPrivacy,
  subscribePrivacy,
  writePrivacy,
} from "@/components/balance-privacy";

afterEach(() => vi.unstubAllGlobals());

it("hides amounts in the server render before browser preferences load", () => {
  expect(serverPrivacy()).toBe(true);
  const html = renderToString(createElement(BalanceValue, null, "$123.45"));
  expect(html).toContain("••••••");
  expect(html).not.toContain("$123.45");
});

it("synchronizes local toggles and other tabs, and removes both listeners", () => {
  const target = new EventTarget();
  const storage = new Map<string, string>();
  vi.stubGlobal(
    "window",
    Object.assign(target, {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    }),
  );
  const changed = vi.fn();
  const unsubscribe = subscribePrivacy(changed);
  expect(readPrivacy()).toBe(false);
  writePrivacy(true);
  expect(readPrivacy()).toBe(true);
  expect(changed).toHaveBeenCalledTimes(1);
  const event = Object.assign(new Event("storage"), {
    key: "ccx-hide-balances",
  });
  storage.set("ccx-hide-balances", "false");
  target.dispatchEvent(event);
  expect(changed).toHaveBeenCalledTimes(2);
  expect(readPrivacy()).toBe(false);
  unsubscribe();
  writePrivacy(true);
  target.dispatchEvent(event);
  expect(changed).toHaveBeenCalledTimes(2);
});

it("keeps the privacy control usable when storage throws", () => {
  vi.stubGlobal(
    "window",
    Object.assign(new EventTarget(), {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      },
    }),
  );
  writePrivacy(true);
  expect(readPrivacy()).toBe(true);
  writePrivacy(false);
  expect(readPrivacy()).toBe(false);
});
