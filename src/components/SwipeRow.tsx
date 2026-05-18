import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Row wrapper that supports two interaction modes without ever overlapping
 * the row's own content:
 *
 *  - **Mobile / touch**: swipe the row left to reveal a full-height red
 *    delete panel underneath. Tap the panel to delete; tap elsewhere or
 *    swipe back to dismiss.
 *  - **Desktop / pointer**: a small trash icon fades in on hover, anchored
 *    to the far right inside reserved padding (`pr-12`) so it never
 *    overlaps any text or numbers in the row.
 */
const REVEAL = 64;

function isTouchDevice() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(hover: none) and (pointer: coarse)").matches ?? false;
}

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
  const [touch, setTouch] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    setTouch(isTouchDevice());
  }, []);

  const reveal = () => setOffset(REVEAL);
  const reset = () => setOffset(0);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "touch") return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    dragging.current = false;
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "touch") return;
    if (startX.current == null || startY.current == null) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (!dragging.current && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      dragging.current = true;
    }
    if (dragging.current) {
      // Allow swipe in either direction relative to current offset.
      const base = offset === 0 ? 0 : -REVEAL;
      const next = Math.max(-REVEAL - 24, Math.min(0, base + dx));
      setOffset(-next);
    }
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "touch") return;
    if (dragging.current) {
      if (offset > REVEAL / 2) reveal();
      else reset();
    }
    startX.current = null;
    startY.current = null;
    dragging.current = false;
  }

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Underlying delete panel — only meaningful on touch (revealed by swipe). */}
      {touch && (
        <button
          type="button"
          aria-label="Delete entry"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
            reset();
          }}
          className="absolute inset-y-0 right-0 flex items-center justify-center bg-destructive text-destructive-foreground"
          style={{ width: REVEAL }}
        >
          <Trash2 className="h-[18px] w-[18px]" />
        </button>
      )}

      {/* Sliding content layer. Reserves right padding on desktop so the
          hover trash icon never overlaps row content. */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateX(-${offset}px)`,
          touchAction: "pan-y",
        }}
        className={cn(
          "relative bg-inherit transition-transform duration-150",
          !touch && "pr-9"
        )}
      >
        {children}

        {/* Desktop hover trash icon — sits inside reserved padding, never overlaps content. */}
        {!touch && (
          <button
            type="button"
            aria-label="Delete entry"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className={cn(
              "absolute right-1.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-destructive/12 hover:text-destructive",
              hover ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          >
            <Trash2 className="h-[13px] w-[13px]" />
          </button>
        )}
      </div>
    </div>
  );
}
