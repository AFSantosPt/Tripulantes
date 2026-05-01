/**
 * Formats a full name by abbreviating middle names to initials.
 * "André Filipe Santos"  → "André F. Santos"
 * "André Filipe João Santos" → "André F. J. Santos"
 * "André Santos"         → "André Santos"  (no change)
 * "André"                → "André"          (no change)
 */
export function formatDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName.trim();
  const first = parts[0];
  const last = parts[parts.length - 1];
  const midInitials = parts
    .slice(1, -1)
    .map((p) => `${p.charAt(0).toUpperCase()}.`)
    .join(" ");
  return `${first} ${midInitials} ${last}`;
}
