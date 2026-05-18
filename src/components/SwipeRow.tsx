import { useRef, useState, type ReactNode, type PointerEvent } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

/**
 * Row wrapper that opens a "Delete this entry?" confirmation after a
 * 1-second press-and-hold. Works the same on touch and pointer devices.
 *
 * Keeps the original `SwipeRow` API (children + onDelete + className) so
 * existing callsites don't need to change.
 */
const HOLD_MS = 1000;
const MOVE_TOLERANCE = 8;

export function SwipeRow({
  children,
  onDelete,
  className,
}: {
  children: ReactNode;
  onDelete: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);

  const clear = () => {
    if (timer.current != null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setHolding(false);
  };

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    // Ignore right-click / non-primary buttons.
    if (e.button !== undefined && e.button !== 0) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    setHolding(true);
    timer.current = setTimeout(() => {
      setHolding(false);
      timer.current = null;
      setOpen(true);
    }, HOLD_MS);
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (timer.current == null) return;
    const dx = Math.abs(e.clientX - startX.current);
    const dy = Math.abs(e.clientY - startY.current);
    if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) clear();
  }

  return (
    <>
      <div
        className={cn(
          "relative select-none transition-colors",
          holding && "bg-muted/30",
          className,
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={clear}
        onPointerCancel={clear}
        onPointerLeave={clear}
        onContextMenu={(e) => {
          // Suppress the browser/mobile context menu while we own the long-press.
          e.preventDefault();
        }}
        style={{ touchAction: "pan-y" }}
      >
        {children}
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the entry from your records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
