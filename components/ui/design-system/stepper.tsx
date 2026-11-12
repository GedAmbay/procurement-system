import React from "react";

export interface StepItem {
  id: number | string;
  stepNumber: number;
  title: string;
  subtitle: string;
  status: "done" | "in_progress" | "not_started";
}

export interface StepperProps {
  steps: StepItem[];
  className?: string;
}

export function Stepper({ steps, className = "" }: StepperProps) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      {steps.map((step) => {
        const isDone = step.status === "done";
        const isInProgress = step.status === "in_progress";

        const topBarColor = isDone
          ? "bg-emerald-600"
          : isInProgress
          ? "bg-blue-600"
          : "bg-slate-200";

        const subtitleColor = isDone
          ? "text-emerald-700 font-medium"
          : isInProgress
          ? "text-blue-700 font-medium"
          : "text-slate-400 font-normal";

        return (
          <div
            key={step.id}
            className="flex flex-col pt-2.5 relative border-t-2 transition-colors"
            style={{
              borderColor: isDone ? "#059669" : isInProgress ? "#2563eb" : "#e2e8f0",
            }}
          >
            <div className="text-xs font-bold text-slate-800">
              {step.stepNumber} · {step.title}
            </div>
            <div className={`text-xs mt-0.5 ${subtitleColor}`}>
              {step.subtitle}
            </div>
          </div>
        );
      })}
    </div>
  );
}

