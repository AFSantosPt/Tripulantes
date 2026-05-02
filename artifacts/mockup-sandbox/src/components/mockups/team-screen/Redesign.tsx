const colors = {
  bg: "#F6F4EF",
  card: "#FFFFFF",
  foreground: "#0F1B2D",
  primary: "#0F2A47",
  primaryFg: "#FFFFFF",
  muted: "#ECE7DC",
  mutedFg: "#6B6558",
  accent: "#F4A93B",
  accentFg: "#0F1B2D",
  destructive: "#C0392B",
  border: "#DCD5C5",
  success: "#2F855A",
};

const members = [
  { name: "André Santos",    nick: "Andrézito", crewId: "180939", isAdmin: true,  isSelf: true,  cats: ["motorista"],  lastSeen: "há 2 min" },
  { name: "Rui Figueiredo",  nick: "",           crewId: "172041", isAdmin: false, isSelf: false, cats: ["guarda-freio"], lastSeen: "há 3h" },
  { name: "Carla Mendes",    nick: "Carlinhas",  crewId: "185320", isAdmin: false, isSelf: false, cats: ["motorista"],  lastSeen: "há 1d" },
  { name: "José Rodrigues",  nick: "",           crewId: "163740", isAdmin: false, isSelf: false, cats: ["motorista", "guarda-freio"], lastSeen: "há 2d" },
  { name: "Marta Sousa",     nick: "",           crewId: "191205", isAdmin: false, isSelf: false, cats: ["motorista"],  lastSeen: "há 5d" },
];

const pending = [
  { name: "Pedro Alves", crewId: "196830", cats: ["guarda-freio"], date: "28 Abr" },
];

function Avatar({ name, primary, size = 40 }: { name: string; primary?: boolean; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2,
      background: primary ? colors.primary : colors.muted,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <span style={{
        color: primary ? colors.primaryFg : colors.mutedFg,
        fontWeight: 700,
        fontSize: size * 0.38,
        lineHeight: 1,
      }}>
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

function CategoryPill({ label }: { label: string }) {
  return (
    <span style={{
      background: colors.muted,
      color: colors.mutedFg,
      fontSize: 10,
      fontWeight: 600,
      padding: "2px 7px",
      borderRadius: 99,
      letterSpacing: 0.2,
    }}>{label}</span>
  );
}

const catLabel: Record<string, string> = {
  "motorista": "Motorista",
  "guarda-freio": "Guarda-freio",
};

export function Redesign() {
  return (
    <div style={{
      width: 390,
      minHeight: 844,
      background: colors.bg,
      fontFamily: "'Inter', system-ui, sans-serif",
      overflowY: "auto",
      position: "relative",
    }}>
      {/* ─── Status bar placeholder ─── */}
      <div style={{ height: 44, background: colors.bg }} />

      {/* ─── Profile card ─── */}
      <div style={{ padding: "0 16px 16px" }}>
        <div style={{
          background: colors.card,
          borderRadius: 18,
          border: `1px solid ${colors.border}`,
          padding: "20px 20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}>
          {/* Avatar + name row */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 58, height: 58, borderRadius: 29,
              background: colors.primary,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 22 }}>A</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: colors.foreground }}>André Santos</span>
                <span style={{
                  background: colors.primary, color: "#fff",
                  fontSize: 10, fontWeight: 700,
                  padding: "2px 7px", borderRadius: 99,
                  display: "flex", alignItems: "center", gap: 3,
                }}>
                  🛡 Admin
                </span>
              </div>
              <div style={{ color: colors.mutedFg, fontSize: 12.5, marginTop: 2 }}>Nº 180939  ·  Motorista</div>
              <div style={{ color: colors.mutedFg, fontSize: 11.5, marginTop: 1 }}>Grupo de folga: B</div>
            </div>
          </div>

          {/* Quick settings grid */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8,
          }}>
            {[
              { icon: "🔒", label: "Password" },
              { icon: "🏷", label: "Categorias" },
              { icon: "😄", label: "Alcunha" },
              { icon: "☀️", label: "Folga" },
              { icon: "📞", label: "Telefone" },
            ].map((item) => (
              <div key={item.label} style={{
                background: colors.muted,
                borderRadius: 12,
                padding: "10px 6px 8px",
                display: "flex", flexDirection: "column",
                alignItems: "center", gap: 4,
                cursor: "pointer",
              }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
                <span style={{ fontSize: 9.5, fontWeight: 600, color: colors.mutedFg, textAlign: "center", lineHeight: 1.1 }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Search bar ─── */}
      <div style={{ padding: "0 16px 12px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          padding: "10px 14px",
        }}>
          <span style={{ fontSize: 15, color: colors.mutedFg }}>🔍</span>
          <span style={{ fontSize: 13.5, color: colors.mutedFg }}>Pesquisar tripulante…</span>
        </div>
      </div>

      {/* ─── Pending section ─── */}
      <div style={{ padding: "0 16px 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: colors.mutedFg, letterSpacing: 0.5 }}>PEDIDOS PENDENTES</span>
          <div style={{
            background: colors.accent,
            color: colors.accentFg,
            fontSize: 10, fontWeight: 700,
            padding: "1px 7px", borderRadius: 99,
          }}>{pending.length}</div>
        </div>
        {pending.map((m) => (
          <div key={m.crewId} style={{
            background: colors.card,
            border: `1.5px solid ${colors.accent}44`,
            borderRadius: 14,
            padding: "12px 14px",
            marginBottom: 8,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 20,
              background: colors.accent + "33",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: colors.accent }}>{m.name.charAt(0)}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: colors.foreground }}>{m.name}</div>
              <div style={{ fontSize: 11.5, color: colors.mutedFg }}>Nº {m.crewId} · pedido {m.date}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{
                background: colors.primary, color: "#fff",
                borderRadius: 8, padding: "6px 12px",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>Aprovar</div>
              <div style={{
                background: colors.muted, color: colors.mutedFg,
                borderRadius: 8, padding: "6px 10px",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>✕</div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Active members section ─── */}
      <div style={{ padding: "4px 16px 100px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: colors.mutedFg, letterSpacing: 0.5 }}>EQUIPA ATIVA</span>
          <div style={{
            background: colors.muted,
            color: colors.mutedFg,
            fontSize: 10, fontWeight: 700,
            padding: "1px 7px", borderRadius: 99,
          }}>{members.length}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {members.map((m) => (
            <div key={m.crewId} style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: 14,
              padding: "12px 14px",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <Avatar name={m.name} primary={m.isAdmin} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5, color: colors.foreground }}>
                    {m.name}{m.nick ? ` (${m.nick})` : ""}
                  </span>
                  {m.isSelf && (
                    <span style={{ fontSize: 10.5, color: colors.mutedFg, fontWeight: 500 }}>tu</span>
                  )}
                  {m.isAdmin && (
                    <span style={{
                      fontSize: 9, fontWeight: 700,
                      background: colors.primary, color: "#fff",
                      padding: "1px 6px", borderRadius: 99,
                    }}>Admin</span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: colors.mutedFg, marginTop: 1 }}>Nº {m.crewId}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
                  {m.cats.map((c) => <CategoryPill key={c} label={catLabel[c] ?? c} />)}
                  <span style={{ fontSize: 10.5, color: colors.mutedFg }}>· {m.lastSeen}</span>
                </div>
              </div>
              {/* Actions button (admin, not self) */}
              {!m.isSelf && (
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: colors.muted,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", flexShrink: 0,
                }}>
                  <span style={{ color: colors.mutedFg, fontSize: 16, letterSpacing: 1, lineHeight: 1 }}>⋯</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
