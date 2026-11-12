import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      icon,
      iconPosition = "left",
      className = "",
      disabled,
      type = "button",
      ...props
    },
    ref
  ) => {
    // 44px min height for touch and a11y target
    const sizeClasses = {
      sm: "min-h-[38px] px-3.5 py-1.5 text-xs rounded-xl gap-1.5",
      md: "min-h-[44px] px-5 py-2.5 text-sm rounded-xl gap-2",
      lg: "min-h-[48px] px-6 py-3 text-base rounded-xl gap-2.5",
    };

    const variantClasses = {
      primary:
        "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
      secondary:
        "bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold border border-slate-300 shadow-sm hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
      ghost:
        "bg-transparent hover:bg-slate-100/80 active:bg-slate-200/80 text-slate-600 hover:text-slate-900 font-medium focus-visible:ring-2 focus-visible:ring-slate-400",
      danger:
        "bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold shadow-sm focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2",
    };

    const disabledClasses = disabled
      ? "opacity-50 cursor-not-allowed pointer-events-none shadow-none"
      : "cursor-pointer transition-colors duration-150";

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={`inline-flex items-center justify-center select-none outline-none ${sizeClasses[size]} ${variantClasses[variant]} ${disabledClasses} ${className}`}
        {...props}
      >
        {icon && iconPosition === "left" && <span className="shrink-0">{icon}</span>}
        <span>{children}</span>
        {icon && iconPosition === "right" && <span className="shrink-0">{icon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";

