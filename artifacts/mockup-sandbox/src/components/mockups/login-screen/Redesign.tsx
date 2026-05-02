import React, { useState } from "react";

const C = {
  bg: "#F6F4EF",
  primary: "#0F2A47",
  accent: "#F4A93B",
  card: "#FFFFFF",
  border: "#DCD5C5",
  muted: "#ECE7DC",
  mutedFg: "#6B6558",
  fg: "#1A1410",
  pfg: "#FFFFFF",
  radius: 14,
  destructive: "#C0392B",
};

/* ── Tram SVG ─────────────────────────────────────────────── */
function TramIllustration() {
  return (
    <svg
      width="260"
      height="130"
      viewBox="0 0 260 130"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Catenary wires */}
      <line x1="0" y1="8" x2="260" y2="8" stroke="#ffffff18" strokeWidth="1" />
      <line x1="0" y1="14" x2="260" y2="14" stroke="#ffffff10" strokeWidth="0.5" />
      {/* Pantograph */}
      <line x1="100" y1="8" x2="92" y2="34" stroke="#F4A93B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="100" y1="8" x2="108" y2="34" stroke="#F4A93B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="88" y1="34" x2="112" y2="34" stroke="#F4A93B" strokeWidth="2" strokeLinecap="round" />
      {/* Tram body */}
      <rect x="14" y="34" width="232" height="64" rx="6" fill={C.accent} />
      {/* Roof strip */}
      <rect x="14" y="34" width="232" height="12" rx="6" fill="#e09825" />
      <rect x="14" y="40" width="232" height="6" fill="#e09825" />
      {/* Front face */}
      <rect x="14" y="34" width="36" height="64" rx="0" fill="#d4891f" />
      <rect x="14" y="34" width="36" height="64" rx="6" fill="#d4891f" />
      {/* Front headlight */}
      <rect x="20" y="82" width="20" height="10" rx="3" fill="#fff9e0" opacity="0.9" />
      {/* Front destination sign */}
      <rect x="18" y="56" width="28" height="14" rx="3" fill={C.primary} />
      <text x="32" y="67" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold" fontFamily="monospace">28</text>
      {/* Windows row */}
      <rect x="58" y="44" width="24" height="20" rx="3" fill={C.primary} opacity="0.85" />
      <rect x="90" y="44" width="24" height="20" rx="3" fill={C.primary} opacity="0.85" />
      <rect x="122" y="44" width="24" height="20" rx="3" fill={C.primary} opacity="0.85" />
      <rect x="154" y="44" width="24" height="20" rx="3" fill={C.primary} opacity="0.85" />
      <rect x="186" y="44" width="24" height="20" rx="3" fill={C.primary} opacity="0.85" />
      {/* Window reflections */}
      <rect x="58" y="44" width="6" height="20" rx="3" fill="#fff" opacity="0.12" />
      <rect x="90" y="44" width="6" height="20" rx="3" fill="#fff" opacity="0.12" />
      <rect x="122" y="44" width="6" height="20" rx="3" fill="#fff" opacity="0.12" />
      <rect x="154" y="44" width="6" height="20" rx="3" fill="#fff" opacity="0.12" />
      <rect x="186" y="44" width="6" height="20" rx="3" fill="#fff" opacity="0.12" />
      {/* Door */}
      <rect x="218" y="50" width="20" height="48" rx="2" fill="#d4891f" />
      <rect x="220" y="54" width="8" height="38" rx="1" fill={C.primary} opacity="0.3" />
      <rect x="230" y="54" width="6" height="38" rx="1" fill={C.primary} opacity="0.3" />
      {/* Underframe */}
      <rect x="14" y="94" width="232" height="8" rx="0" fill="#b07316" />
      {/* Rail / ground line */}
      <rect x="0" y="116" width="260" height="2.5" rx="1" fill="#ffffff25" />
      {/* Bogies / wheel frames */}
      <rect x="28" y="100" width="50" height="14" rx="4" fill={C.primary} />
      <rect x="182" y="100" width="50" height="14" rx="4" fill={C.primary} />
      {/* Wheels */}
      <circle cx="44" cy="112" r="10" fill={C.primary} stroke="#ffffff30" strokeWidth="1.5" />
      <circle cx="44" cy="112" r="5" fill="#304a68" />
      <circle cx="62" cy="112" r="10" fill={C.primary} stroke="#ffffff30" strokeWidth="1.5" />
      <circle cx="62" cy="112" r="5" fill="#304a68" />
      <circle cx="198" cy="112" r="10" fill={C.primary} stroke="#ffffff30" strokeWidth="1.5" />
      <circle cx="198" cy="112" r="5" fill="#304a68" />
      <circle cx="216" cy="112" r="10" fill={C.primary} stroke="#ffffff30" strokeWidth="1.5" />
      <circle cx="216" cy="112" r="5" fill="#304a68" />
    </svg>
  );
}

/* ── Mock TextField ─────────────────────────────────────────── */
function Field({
  label,
  placeholder,
  type = "text",
  error,
}: {
  label: string;
  placeholder: string;
  type?: string;
  error?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, fontFamily: "Inter, sans-serif", fontWeight: 600, color: C.mutedFg, letterSpacing: "0.5px" }}>
        {label.toUpperCase()}
      </label>
      <div
        style={{
          background: C.muted,
          border: `1px solid ${error ? C.destructive : C.border}`,
          borderRadius: 10,
          padding: "12px 14px",
          fontSize: 15,
          fontFamily: "Inter, sans-serif",
          color: C.mutedFg,
        }}
      >
        {placeholder}
      </div>
      {error && (
        <span style={{ fontSize: 12, color: C.destructive, fontFamily: "Inter, sans-serif" }}>{error}</span>
      )}
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────── */
export default function LoginRedesign() {
  const [tab, setTab] = useState<"normal" | "error">("normal");

  return (
    <div style={{ width: 390, height: 844, background: C.bg, overflow: "hidden", fontFamily: "Inter, sans-serif", position: "relative", display: "flex", flexDirection: "column" }}>

      {/* ─ Hero ─ */}
      <div style={{
        background: C.primary,
        padding: "56px 0 32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative route dots */}
        <div style={{ position: "absolute", top: 16, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
          {[...Array(7)].map((_, i) => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === 3 ? C.accent : "#ffffff15" }} />
          ))}
        </div>

        {/* Tram */}
        <div style={{ marginTop: 8 }}>
          <TramIllustration />
        </div>

        {/* App title */}
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#fff", letterSpacing: "-0.5px", lineHeight: 1 }}>
            Tripulante
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.accent, marginTop: 4, letterSpacing: "0.2px" }}>
            gestão
          </div>
        </div>
      </div>

      {/* ─ Form card ─ */}
      <div style={{
        flex: 1,
        padding: "24px 20px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        overflowY: "auto",
      }}>

        {/* Toggle for demo */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {(["normal", "error"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "4px 10px",
                borderRadius: 99,
                border: `1px solid ${C.border}`,
                background: tab === t ? C.primary : C.muted,
                color: tab === t ? "#fff" : C.mutedFg,
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {t === "normal" ? "normal" : "com erro"}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Nº Tripulante" placeholder="Ex: 180123" />
          <Field
            label="Password"
            placeholder={tab === "error" ? "•••••••" : "A tua password"}
            type="password"
            error={tab === "error" ? "Credenciais incorretas. Verifica o número e a password." : undefined}
          />
        </div>

        {/* Submit */}
        <button style={{
          background: C.primary,
          color: "#fff",
          border: "none",
          borderRadius: C.radius,
          padding: "15px 20px",
          fontSize: 15,
          fontWeight: 600,
          fontFamily: "Inter, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          cursor: "pointer",
          width: "100%",
        }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          Entrar
        </button>

        {/* Register link */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: 14,
          border: `1px solid ${C.border}`,
          borderRadius: C.radius,
          background: C.card,
          cursor: "pointer",
          marginTop: 4,
        }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: C.primary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.fg }}>Pedir acesso</div>
            <div style={{ fontSize: 12, color: C.mutedFg, marginTop: 2 }}>Um tripulante autorizado terá de aprovar</div>
          </div>
          <svg width="18" height="18" fill="none" stroke={C.mutedFg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    </div>
  );
}
