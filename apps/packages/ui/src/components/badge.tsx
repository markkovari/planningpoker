import { cva, type VariantProps } from "class-variance-authority";
import React from "react";
import { cn } from "./utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
        secondary: "border-transparent bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]",
        destructive: "border-transparent bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]",
        outline: "text-[hsl(var(--foreground))]",
        success: "border-transparent bg-[hsl(var(--success))] text-white",
        muted: "border-transparent bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
