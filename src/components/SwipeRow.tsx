import { useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
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
 * Row wrapper with an always-visible small grey trash button on the far
 * right. Tapping opens a confirmation dialog. Reserves right padding so
 * the icon never overlaps row content (prices, percentages, etc.).
 *
 * Keeps the original `SwipeRow` API (children + onDelete + className) so
 * existing callsites don't need to change.
 */
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

  return (
    <>
      <div className={cn("relative", className)}>
        {/* Reserve right padding so the trash button never overlaps row content. */}
        <div className="pr-9">{children}</div>

        <button
          type="button"
          aria-label="Delete entry"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
        </button>
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
