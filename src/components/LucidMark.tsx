import { cn } from "@/lib/utils";

export function LucidMark({
  size = 32,
  className,
  stroke = "#5B8DEF",
  fill = "#5B8DEF",
}: {
  size?: number;
  className?: string;
  stroke?: string;
  fill?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 80 80"
      className={cn("flex-shrink-0", className)}
      aria-hidden
    >
      <polygon
        points="40,8 64,22 64,50 40,64 16,50 16,22"
        fill="none"
        stroke={stroke}
        strokeWidth={2}
      />
      <polygon
        points="40,18 56,28 56,48 40,58 24,48 24,28"
        fill="none"
        stroke={stroke}
        strokeWidth={1.2}
      />
      <circle cx="40" cy="38" r="5" fill={fill} />
    </svg>
  );
}
