import React, { useState } from "react";

/* Carris brand colors + app palette */
const C = {
  bg: "#F6F4EF",
  hero: "#E30613",          /* Carris red */
  tramBody: "#F9B000",      /* Carris yellow */
  tramDark: "#C78000",      /* darker yellow for shading */
  tramWindow: "#1A0A00",    /* near-black for windows */
  accent: "#F9B000",
  card: "#FFFFFF",
  border: "#DCD5C5",
  muted: "#ECE7DC",
  mutedFg: "#6B6558",
  fg: "#1A1410",
  radius: 14,
  destructive: "#C0392B",
};

/* ── Tram SVG ─────────────────────────────────────────────── */
function TramIllustration() {
  return (
    <svg
      width="270"
      height="134"
      viewBox="0 0 270 134"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Catenary wires */}
      <line x1="0" y1="8" x2="270" y2="8" stroke="#ffffff28" strokeWidth="1" />
      <line x1="0" y1="14" x2="270" y2="14" stroke="#ffffff14" strokeWidth="0.6" />

      {/* Pantograph arms */}
      <line x1="104" y1="8" x2="95" y2="34" stroke={C.accent} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="104" y1="8" x2="113" y2="34" stroke={C.accent} strokeWidth="1.8" strokeLinecap="round" />
      {/* Pantograph crossbar */}
      <rect x="90" y="32" width="28" height="3" rx="1.5" fill={C.accent} />

      {/* Tram body */}
      <rect x="14" y="36" width="242" height="62" rx="6" fill={C.tramBody} />

      {/* Roof band */}
      <rect x="14" y="36" width="242" height="11" rx="5" fill={C.tramDark} />
      <rect x="14" y="41" width="242" height="6" fill={C.tramDark} />

      {/* Front cab */}
      <rect x="14" y="36" width="34" height="62" rx="0" fill={C.tramDark} />
      <rect x="14" y="36" width="34" height="62" rx="6" fill={C.tramDark} />
      {/* Front headlight */}
      <rect x="20" y="82" width="20" height="10" rx="3" fill="#fffde0" opacity="0.9" />
      {/* Route sign */}
      <rect x="17" y="56" width="28" height="15" rx="3" fill="#1a0a00" />
      <text x="31" y="67.5" textAnchor="middle" fill="#fff" fontSize="8.5" fontWeight="bold" fontFamily="monospace">28E</text>

      {/* Windows */}
      {[56, 90, 124, 158, 192].map((x) => (
        <g key={x}>
          <rect x={x} y="46" width="26" height="20" rx="3" fill={C.tramWindow} opacity="0.82" />
          <rect x={x} y="46" width="6" height="20" rx="3" fill="#fff" opacity="0.09" />
        </g>
      ))}

      {/* Door (rear) */}
      <rect x="222" y="50" width="22" height="48" rx="2" fill={C.tramDark} />
      <rect x="224" y="54" width="9" height="38" rx="1" fill={C.tramWindow} opacity="0.4" />
      <rect x="234" y="54" width="8" height="38" rx="1" fill={C.tramWindow} opacity="0.4" />

      {/* Bottom skirt */}
      <rect x="14" y="94" width="242" height="7" rx="0" fill={C.tramDark} />

      {/* Rail line */}
      <rect x="0" y="118" width="270" height="2.5" rx="1" fill="#ffffff22" />

      {/* Bogie frames */}
      <rect x="26" y="100" width="52" height="14" rx="4" fill="#1a0a00" />
      <rect x="192" y="100" width="52" height="14" rx="4" fill="#1a0a00" />

      {/* Wheels */}
      {[42, 62, 208, 228].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="113" r="11" fill="#1a0a00" stroke="#ffffff22" strokeWidth="1.5" />
          <circle cx={cx} cy="113" r="5.5" fill="#2e1a00" />
          <circle cx={cx} cy="113" r="2" fill={C.tramDark} opacity="0.6" />
        </g>
      ))}
    </svg>
  );
}

/* ── Mock Field ─────────────────────────────────────────────── */
function Field({
  label,
  placeholder,
  error,
}: {
  label: string;
  placeholder: string;
  error?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, fontFamily: "Inter, sans-serif", fontWeight: 700, color: C.mutedFg, letterSpacing: "0.6px" }}>
        {label.toUpperCase()}
      </label>
      <div style={{
        background: C.muted,
        border: `1.5px solid ${error ? C.destructive : C.border}`,
        borderRadius: 10,
        padding: "12px 14px",
        fontSize: 15,
        fontFamily: "Inter, sans-serif",
        color: error ? C.fg : C.mutedFg,
      }}>
        {placeholder}
      </div>
      {error && (
        <span style={{ fontSize: 12, color: C.destructive, fontFamily: "Inter, sans-serif", lineHeight: 1.4 }}>{error}</span>
      )}
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────── */
export default function LoginRedesign() {
  const [tab, setTab] = useState<"normal" | "error">("normal");

  return (
    <div style={{ width: 390, height: 844, background: C.bg, overflow: "hidden", fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column" }}>

      {/* ─ Hero ─ */}
      <div style={{
        background: C.hero,
        paddingTop: 52,
        paddingBottom: 30,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Background route dots */}
        <div style={{ position: "absolute", top: 18, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 7 }}>
          {[...Array(9)].map((_, i) => (
            <div key={i} style={{
              width: i === 4 ? 8 : 5,
              height: i === 4 ? 8 : 5,
              borderRadius: "50%",
              background: i === 4 ? C.accent : "#ffffff22",
              marginTop: i === 4 ? -1.5 : 0,
            }} />
          ))}
        </div>

        {/* Subtle radial glow behind tram */}
        <div style={{
          position: "absolute",
          top: 60,
          left: "50%",
          transform: "translateX(-50%)",
          width: 280,
          height: 140,
          background: "radial-gradient(ellipse, rgba(249,176,0,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Tram illustration */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <TramIllustration />
        </div>

        {/* App identity */}
        <div style={{ textAlign: "center", marginTop: 10, position: "relative", zIndex: 1 }}>
          <div style={{
            fontSize: 30,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-0.6px",
            lineHeight: 1,
          }}>
            Tripulantes
          </div>
          <div style={{
            fontSize: 14,
            fontWeight: 600,
            color: C.accent,
            marginTop: 5,
            letterSpacing: "2px",
            textTransform: "uppercase",
          }}>
            gestão
          </div>
        </div>
      </div>

      {/* ─ Form ─ */}
      <div style={{
        flex: 1,
        padding: "24px 20px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        overflowY: "auto",
      }}>

        {/* Demo toggle */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {(["normal", "error"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "4px 12px",
                borderRadius: 99,
                border: `1px solid ${C.border}`,
                background: tab === t ? C.hero : C.muted,
                color: tab === t ? "#fff" : C.mutedFg,
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                fontWeight: 600,
              }}
            >
              {t === "normal" ? "Normal" : "Com erro"}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Nº Tripulante" placeholder="Ex: 180123" />
          <Field
            label="Password"
            placeholder={tab === "error" ? "••••••••" : "A tua password"}
            error={tab === "error" ? "Credenciais incorretas. Verifica o número e a password." : undefined}
          />
        </div>

        {/* Submit */}
        <button style={{
          background: C.hero,
          color: "#fff",
          border: "none",
          borderRadius: C.radius,
          padding: "15px 20px",
          fontSize: 15,
          fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          cursor: "pointer",
          width: "100%",
        }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          Entrar
        </button>

        {/* Register */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: 14,
          border: `1.5px solid ${C.border}`,
          borderRadius: C.radius,
          background: C.card,
          cursor: "pointer",
          marginTop: 2,
        }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: C.hero,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
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
