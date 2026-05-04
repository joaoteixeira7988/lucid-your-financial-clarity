import { useRef, useState, type ReactNode, type PointerEvent } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Row wrapper that supports:
 *  - Touch swipe-left to reveal a delete action
 *  - Desktop hover or press-and-hold to reveal a small trash icon
 *
 * The wrapped row content is rendered as `children`. `onDelete` fires when
 * the user taps/clicks the trash icon. We intentionally don't show a
 * confirm dialog — the calling page surfaces a toast instead.
 */
const REVEAL = 76;

export function SwipeRow({
  children,
  onDelete,
  className,
}: {
  children: ReactNode;
  onDelete: () => void;
  className?: string;
}) {
  const [offset, setOffset] = useState(0);
  const [hover, setHover] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const dragging = useRef(false);
  const holdTimer = useRef<number | null>(null);
  const [held, setHeld] = useState(false);

  const reveal = () => setOffset(REVEAL);
  const reset = () => setOffset(0);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    startX.current = e.clientX;
    startY.current = e.clientY;
    dragging.current = false;
    if (e.pointerType !== "touch") {
      holdTimer.current = window.setTimeout(() => setHeld(true), 450);
    }
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (startX.current == null || startY.current == null) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (!dragging.current && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      dragging.current = true;
      if (holdTimer.current) window.clearTimeout(holdTimer.current);
    }
    if (dragging.current) {
      e.preventDefault();
      const next = Math.max(-REVEAL - 20, Math.min(0, dx));
      setOffset(-next);
    }
  }
  function onPointerUp() {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (dragging.current) {
      if (offset > REVEAL / 2) reveal();
      else reset();
    }
    startX.current = null;
    startY.current = null;
    dragging.current = false;
  }

  const showAction = offset > 8 || hover || held;

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setHeld(false); reset(); }}
    >
      {/* Action layer */}
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
        <button
          type="button"
          aria-label="Delete entry"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
            reset();
            setHeld(false);
          }}
          className={cn(
            "pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-destructive/15 text-destructive transition-opacity",
            showAction ? "opacity-100" : "opacity-0"
          )}
        >
          <Trash2 className="h-[15px] w-[15px]" />
        </button>
      </div>

      {/* Sliding content */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ transform: `translateX(-${offset}px)`, touchAction: "pan-y" }}
        className="relative bg-inherit transition-transform duration-150"
      >
        {children}
      </div>
    </div>
  );
}
