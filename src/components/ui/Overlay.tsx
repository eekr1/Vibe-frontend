import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type RefObject
} from "react";
import { createPortal } from "react-dom";
import { acquireBodyScrollLock, getFocusableElements, getWrappedFocusIndex, restoreFocus } from "./overlayFocus";
import { mergeClassNames } from "./utils";

type InitialFocusRef = { readonly current: HTMLElement | null };

function useOverlayFocus({
  containerRef,
  dismissible,
  initialFocusRef,
  onClose
}: {
  containerRef: RefObject<HTMLElement | null>;
  dismissible: boolean;
  initialFocusRef?: InitialFocusRef;
  onClose: () => void;
}) {
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  onCloseRef.current = onClose;
  dismissibleRef.current = dismissible;

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const releaseScrollLock = acquireBodyScrollLock();
    const container = containerRef.current;

    const focusInitial = () => {
      const next = initialFocusRef?.current ?? (container ? getFocusableElements(container)[0] : null) ?? container;
      next?.focus();
    };
    queueMicrotask(focusInitial);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissibleRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !containerRef.current) return;
      const focusable = getFocusableElements(containerRef.current);
      if (!focusable.length) {
        event.preventDefault();
        containerRef.current.focus();
        return;
      }
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const nextIndex = getWrappedFocusIndex(currentIndex, focusable.length, event.shiftKey);
      if (currentIndex === -1 || (event.shiftKey && currentIndex === 0) || (!event.shiftKey && currentIndex === focusable.length - 1)) {
        event.preventDefault();
        focusable[nextIndex]?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      releaseScrollLock();
      queueMicrotask(() => restoreFocus(previousFocus));
    };
  }, [containerRef, initialFocusRef]);
}

function Portal({ children }: { children: ReactNode }) {
  return typeof document === "undefined" ? children : createPortal(children, document.body);
}

type OverlayDialogProps = HTMLAttributes<HTMLElement> & {
  descriptionId?: string;
  dismissible?: boolean;
  initialFocusRef?: InitialFocusRef;
  onClose: () => void;
  titleId: string;
  variant: "bottom-sheet" | "drawer" | "modal" | "side-panel";
};

function OverlayDialog({
  children,
  className,
  descriptionId,
  dismissible = true,
  initialFocusRef,
  onClose,
  titleId,
  variant,
  ...props
}: OverlayDialogProps) {
  const containerRef = useRef<HTMLElement>(null);
  useOverlayFocus({ containerRef, dismissible, initialFocusRef, onClose });

  return (
    <Portal>
      <div
        className={mergeClassNames("ui-overlay-backdrop", `ui-overlay-backdrop--${variant}`)}
        onMouseDown={(event) => {
          if (dismissible && event.target === event.currentTarget) onClose();
        }}
      >
        <section
          {...props}
          aria-describedby={descriptionId}
          aria-labelledby={titleId}
          aria-modal="true"
          className={mergeClassNames("ui-overlay-surface", `ui-overlay-surface--${variant}`, className)}
          ref={containerRef}
          role="dialog"
          tabIndex={-1}
        >
          {children}
        </section>
      </div>
    </Portal>
  );
}

type PublicOverlayProps = Omit<OverlayDialogProps, "variant">;

export function Modal(props: PublicOverlayProps) {
  return <OverlayDialog {...props} variant="modal" />;
}

export function SidePanel(props: PublicOverlayProps) {
  return <OverlayDialog {...props} variant="side-panel" />;
}

export function Drawer(props: PublicOverlayProps) {
  return <OverlayDialog {...props} variant="drawer" />;
}

export function BottomSheet(props: PublicOverlayProps) {
  return <OverlayDialog {...props} variant="bottom-sheet" />;
}

export type PopoverMenuProps = HTMLAttributes<HTMLDivElement> & {
  align?: "end" | "start";
  anchorRef: RefObject<HTMLElement | null>;
  id: string;
  label: string;
  onClose: () => void;
};

export function PopoverMenu({ align = "start", anchorRef, children, className, id, label, onClose, ...props }: PopoverMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ opacity: 0 });
  useOverlayFocus({ containerRef, dismissible: true, onClose });

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const previousControls = anchor.getAttribute("aria-controls");
    const previousExpanded = anchor.getAttribute("aria-expanded");
    const previousHasPopup = anchor.getAttribute("aria-haspopup");
    anchor.setAttribute("aria-controls", id);
    anchor.setAttribute("aria-expanded", "true");
    anchor.setAttribute("aria-haspopup", "menu");
    return () => {
      if (previousControls === null) anchor.removeAttribute("aria-controls"); else anchor.setAttribute("aria-controls", previousControls);
      if (previousExpanded === null) anchor.removeAttribute("aria-expanded"); else anchor.setAttribute("aria-expanded", previousExpanded);
      if (previousHasPopup === null) anchor.removeAttribute("aria-haspopup"); else anchor.setAttribute("aria-haspopup", previousHasPopup);
    };
  }, [anchorRef, id]);

  useLayoutEffect(() => {
    const position = () => {
      const anchor = anchorRef.current;
      const menu = containerRef.current;
      if (!anchor || !menu) return;
      const margin = 12;
      const gap = 8;
      const anchorRect = anchor.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const preferredLeft = align === "end" ? anchorRect.right - menuRect.width : anchorRect.left;
      const left = Math.min(Math.max(margin, preferredLeft), window.innerWidth - menuRect.width - margin);
      const below = anchorRect.bottom + gap;
      const top = below + menuRect.height <= window.innerHeight - margin
        ? below
        : Math.max(margin, anchorRect.top - menuRect.height - gap);
      setStyle({ left, opacity: 1, top });
    };
    position();
    window.addEventListener("resize", position);
    return () => window.removeEventListener("resize", position);
  }, [align, anchorRef]);

  useEffect(() => {
    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !anchorRef.current?.contains(target)) onClose();
    };
    document.addEventListener("pointerdown", handleOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer, true);
  }, [anchorRef, onClose]);

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || !containerRef.current) return;
    const items = Array.from(containerRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'));
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Home") items[0]?.focus();
    else if (event.key === "End") items.at(-1)?.focus();
    else items[getWrappedFocusIndex(current, items.length, event.key === "ArrowUp")]?.focus();
  }

  return (
    <Portal>
      <div className="ui-popover-layer">
        <div
          {...props}
          aria-label={label}
          className={mergeClassNames("ui-popover-menu", className)}
          id={id}
          onKeyDown={handleMenuKeyDown}
          ref={containerRef}
          role="menu"
          style={{ ...style, ...props.style }}
          tabIndex={-1}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
}
