import type { Rating } from "@/lib/mockData";

export const ratingStyles: Record<Rating, { bg: string; text: string; border: string; label: string }> = {
  BUY:         { bg: "bg-success/15",     text: "text-success",            border: "border-success/40",     label: "BUY" },
  HOLD:        { bg: "bg-warning/15",     text: "text-warning",            border: "border-warning/40",     label: "HOLD" },
  SELL:        { bg: "bg-destructive/15", text: "text-destructive-strong", border: "border-destructive/40", label: "SELL" },
  SPECULATIVE: { bg: "bg-primary/15",     text: "text-primary",            border: "border-primary/40",     label: "SPEC" },
};

export const RatingBadge = ({ rating, size = "sm" }: { rating: Rating; size?: "sm" | "md" }) => {
  const s = ratingStyles[rating];
  return (
    <span
      className={`inline-flex items-center rounded-md border font-mono font-semibold tracking-wider ${s.bg} ${s.text} ${s.border}
        ${size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"}`}
    >
      {s.label}
    </span>
  );
};
