import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:w-4 [&_svg]:h-4 [&_svg]:shrink-0" +
    " hover-elevate active-elevate-2", {
    variants: {
        variant: {
            default: "bg-primary text-primary-foreground border border-primary-border shadow-sm hover:bg-primary/95",
            destructive: "bg-destructive text-destructive-foreground shadow-sm border border-destructive-border hover:bg-destructive/90",
            outline: "bg-transparent border border-[var(--button-outline)] text-foreground hover:bg-white/5 hover:border-white/15",
            secondary: "bg-secondary text-secondary-foreground border border-secondary-border hover:bg-secondary/90",
            ghost: "bg-transparent text-foreground hover:bg-white/5",
            link: "text-primary underline-offset-4 hover:underline",
        },
        size: {
            default: "min-h-9 px-4 py-2",
            sm: "min-h-8 rounded-md px-3 text-xs",
            lg: "min-h-10 rounded-md px-8",
            icon: "h-9 w-9",
        },
    },
    defaultVariants: {
        variant: "default",
        size: "default",
    },
});
const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (<Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}/>);
});
Button.displayName = "Button";
export { Button, buttonVariants };
