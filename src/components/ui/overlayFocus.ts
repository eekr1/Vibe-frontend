export const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

export function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => {
    return !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true";
  });
}

export function getWrappedFocusIndex(currentIndex: number, total: number, backwards: boolean) {
  if (total <= 0) return -1;
  if (currentIndex < 0) return backwards ? total - 1 : 0;
  return (currentIndex + (backwards ? -1 : 1) + total) % total;
}

export type RestorableFocusTarget = { focus: () => void; isConnected: boolean };

export function restoreFocus(target: RestorableFocusTarget | null) {
  if (target?.isConnected) target.focus();
}

let scrollLockCount = 0;
let previousOverflow = "";
let previousPaddingRight = "";

export function acquireBodyScrollLock() {
  if (typeof document === "undefined") return () => undefined;
  const body = document.body;
  if (scrollLockCount === 0) {
    previousOverflow = body.style.overflow;
    previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    const currentPadding = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
  }
  scrollLockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    }
  };
}
