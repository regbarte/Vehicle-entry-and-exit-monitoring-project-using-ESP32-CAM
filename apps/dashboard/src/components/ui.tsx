import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { formatPlate } from "../lib/format";

type Variant = "primary" | "secondary" | "quiet" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-teal text-paper hover:bg-teal-deep disabled:bg-ink-faint",
  secondary: "border border-ink/25 bg-white text-ink hover:border-ink/50 disabled:text-ink-faint",
  quiet: "text-ink-soft hover:text-ink hover:bg-ink/5 disabled:text-ink-faint",
  danger: "border border-clay-deep/40 bg-white text-clay-deep hover:bg-clay-wash",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "md" | "lg" }) {
  const sizing = size === "lg" ? "h-14 px-6 text-lg" : "h-10 px-4 text-sm";
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed ${sizing} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed as children
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

const inputClass =
  "h-10 rounded-md border border-ink/20 bg-white px-3 text-sm text-ink placeholder:text-ink-faint focus:border-teal focus:outline-none";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputClass} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${inputClass} pr-8 ${className}`} {...props} />;
}

export function Plate({ plate, size = "md" }: { plate: string; size?: "md" | "xl" }) {
  const sizing = size === "xl" ? "text-4xl px-4 py-1.5 tracking-wider" : "text-sm px-1.5 py-0.5";
  return (
    <span
      className={`inline-block rounded border border-ink/30 bg-white font-mono font-semibold text-ink ${sizing}`}
    >
      {formatPlate(plate)}
    </span>
  );
}

export function VerdictBadge({ verdict }: { verdict: "registered" | "visitor" }) {
  return verdict === "registered" ? (
    <span className="rounded-full bg-teal-wash px-2.5 py-0.5 text-xs font-medium text-teal">
      Registered
    </span>
  ) : (
    <span className="rounded-full bg-clay-wash px-2.5 py-0.5 text-xs font-medium text-clay-deep">
      Visitor
    </span>
  );
}

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {children && <p className="mt-1 text-sm text-ink-soft">{children}</p>}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : "Something went wrong";
  return (
    <p role="alert" className="rounded-md bg-clay-wash px-3 py-2 text-sm text-clay-deep">
      {message}
    </p>
  );
}

export function Loading() {
  return <p className="py-8 text-sm text-ink-soft">Loading…</p>;
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}
