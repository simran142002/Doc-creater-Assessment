import { avatarColor, initials } from "@/lib/client/format";
import { cn } from "@/lib/utils";

export function Avatar({ name, size, className }: { name: string; size?: "xs" | "sm" | "lg" | "xl"; className?: string }) {
  return (
    <span className={cn("av", size && `av--${size}`, className)} style={{ "--av": avatarColor(name) } as React.CSSProperties} title={name}>
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, max = 3, size = "xs" }: { names: string[]; max?: number; size?: "xs" | "sm" }) {
  return (
    <span className="av-stack">
      {names.slice(0, max).map((n, i) => <Avatar key={`${n}-${i}`} name={n} size={size} />)}
      {names.length > max && <span className={`av av--${size} av-more`}>+{names.length - max}</span>}
    </span>
  );
}
