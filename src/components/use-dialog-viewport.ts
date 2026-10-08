"use client";

import { useEffect, type RefObject } from "react";

/** iOS keyboards resize the visual viewport without resizing the layout viewport. */
export function useDialogViewport(
  ref: RefObject<HTMLDialogElement | null>,
  open: boolean,
) {
  useEffect(() => {
    const dialog = ref.current;
    const viewport = window.visualViewport;
    if (!open || !dialog || !viewport) return;
    const box = dialog.querySelector<HTMLElement>(".modal-box");
    if (!box) return;
    const update = () => {
      const mobile = window.matchMedia("(max-width: 1023px)").matches;
      const bottom = mobile
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      dialog.style.paddingBottom = bottom ? `${bottom}px` : "";
      box.style.maxHeight = mobile
        ? `${Math.max(120, viewport.height - 24)}px`
        : "";
      const focused = document.activeElement;
      if (mobile && focused instanceof HTMLElement && box.contains(focused)) {
        const scroller =
          box.querySelector<HTMLElement>("[data-dialog-scroll]") ?? box;
        const bounds = focused.getBoundingClientRect();
        const actions = box.querySelector<HTMLElement>(".modal-action");
        const visibleBottom = Math.min(
          viewport.height + viewport.offsetTop,
          actions && !actions.contains(focused)
            ? actions.getBoundingClientRect().top - 12
            : Infinity,
        );
        if (bounds.bottom > visibleBottom)
          scroller.scrollTop += bounds.bottom - visibleBottom;
        else if (bounds.top < scroller.getBoundingClientRect().top + 12)
          scroller.scrollTop -=
            scroller.getBoundingClientRect().top + 12 - bounds.top;
      }
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    dialog.addEventListener("focusin", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      dialog.removeEventListener("focusin", update);
      dialog.style.paddingBottom = "";
      box.style.maxHeight = "";
    };
  }, [open, ref]);
}
