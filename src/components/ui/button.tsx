import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "default" | "sm" | "icon";
  variant?: "default" | "navy" | "ghost";
}

export function Button({ className, size = "default", variant = "default", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center border border-white/10 font-medium text-paper transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" && "h-8 rounded-[9px] px-3 text-xs",
        size === "icon" && "size-9 rounded-[9px]",
        size === "default" && "h-10 rounded-[10px] px-4 text-sm",
        variant === "navy" && "bg-navy hover:bg-white/10",
        variant === "ghost" && "bg-transparent hover:bg-white/10",
        variant === "default" && "bg-accent text-accent-fg hover:brightness-110",
        className,
      )}
    />
  );
}
