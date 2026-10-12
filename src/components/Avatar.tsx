import type { Person } from "../../shared/types";

/**
 * A round initial in the person's colour, or a star for the whole family. The name is always
 * written next to it, so screen readers skip it. `className` picks the look ("plan-av" in trip plans).
 */
export function Avatar({ person, className = "avatar", size }: { person: Pick<Person, "name" | "color"> | null; className?: string; size?: number }) {
  return (
    <span
      className={className}
      style={{ background: person?.color ?? "var(--muted)", ...(size ? { width: size, height: size } : {}) }}
      title={person?.name ?? "Everyone"}
      aria-hidden
    >
      {person ? person.name.slice(0, 1).toUpperCase() : "★"}
    </span>
  );
}
