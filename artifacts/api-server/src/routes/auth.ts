import { Router } from "express";
import { hashPassword, verifyPassword } from "../lib/hash";
import { newId } from "../lib/id";
import {
  type CrewCategory,
  type CrewMember,
  readMembers,
  sanitize,
  writeMembers,
} from "../lib/store";

const ALL_CREW_CATEGORIES: CrewCategory[] = [
  "guarda-freio",
  "motorista",
  "outro",
];

const router = Router();

function normalizeCrewId(id: string): string {
  return id.trim().toLowerCase();
}

async function requireAdmin(
  memberId: string | undefined,
  members: CrewMember[],
): Promise<CrewMember | null> {
  if (!memberId) return null;
  const m = members.find((x) => x.id === memberId);
  if (!m || m.status !== "active" || !m.isAdmin) return null;
  return m;
}

async function requireMember(
  memberId: string | undefined,
  members: CrewMember[],
): Promise<CrewMember | null> {
  if (!memberId) return null;
  const m = members.find((x) => x.id === memberId);
  if (!m || m.status !== "active") return null;
  return m;
}

router.get("/auth/status", async (_req, res) => {
  const members = await readMembers();
  const hasAdmin = members.some((m) => m.status === "active" && m.isAdmin);
  res.json({ hasAdmin });
});

router.post("/auth/signin", async (req, res) => {
  const { crewId, password } = req.body ?? {};
  if (!crewId || !password) {
    res.status(400).json({ error: "crewId e password obrigatórios" });
    return;
  }
  const members = await readMembers();
  const found = members.find(
    (m) => normalizeCrewId(m.crewId) === normalizeCrewId(crewId),
  );
  if (!found) {
    res.status(401).json({ error: "Nº Tripulante não encontrado" });
    return;
  }
  if (!verifyPassword(password, found.passwordHash)) {
    res.status(401).json({ error: "Password incorreta" });
    return;
  }
  if (found.status === "pending") {
    res
      .status(403)
      .json({ error: "Conta ainda não aprovada por um tripulante autorizado" });
    return;
  }
  res.json({ member: sanitize(found) });
});

router.post("/auth/register", async (req, res) => {
  const { name, crewId, password, categories } = req.body ?? {};
  if (!name?.trim()) {
    res.status(400).json({ error: "Indica o teu nome" });
    return;
  }
  if (!crewId?.trim()) {
    res.status(400).json({ error: "Indica o teu Nº Tripulante" });
    return;
  }
  if (!password || password.length < 4) {
    res
      .status(400)
      .json({ error: "Password tem de ter pelo menos 4 caracteres" });
    return;
  }
  if (!Array.isArray(categories) || categories.length === 0) {
    res.status(400).json({ error: "Seleciona pelo menos uma categoria" });
    return;
  }
  const validCats = (categories as string[]).filter((c): c is CrewCategory =>
    ALL_CREW_CATEGORIES.includes(c as CrewCategory),
  );

  const members = await readMembers();
  const idLower = normalizeCrewId(crewId);
  const existing = members.find(
    (m) => normalizeCrewId(m.crewId) === idLower,
  );
  if (existing) {
    res
      .status(409)
      .json({ error: "Já existe um pedido com este Nº Tripulante" });
    return;
  }

  const hasActiveAdmin = members.some(
    (m) => m.status === "active" && m.isAdmin,
  );
  const autoActivated = !hasActiveAdmin;

  const created: CrewMember = {
    id: newId(),
    name: name.trim(),
    crewId: crewId.trim(),
    passwordHash: hashPassword(password),
    status: autoActivated ? "active" : "pending",
    isAdmin: autoActivated,
    categories: validCats,
    createdAt: new Date().toISOString(),
    approvedAt: autoActivated ? new Date().toISOString() : undefined,
  };

  await writeMembers([...members, created]);
  res.status(201).json({ member: sanitize(created), autoActivated });
});

router.get("/auth/members", async (req, res) => {
  const requesterId = req.headers["x-member-id"] as string | undefined;
  const members = await readMembers();
  const admin = await requireAdmin(requesterId, members);
  if (!admin) {
    res.status(403).json({ error: "Sem permissão" });
    return;
  }
  res.json({ members: members.map(sanitize) });
});

router.get("/auth/me", async (req, res) => {
  const memberId = req.headers["x-member-id"] as string | undefined;
  const members = await readMembers();
  const found = members.find((m) => m.id === memberId);
  if (!found) {
    res.status(404).json({ error: "Membro não encontrado" });
    return;
  }
  res.json({ member: sanitize(found) });
});

router.post("/auth/members/:id/approve", async (req, res) => {
  const requesterId = req.headers["x-member-id"] as string | undefined;
  const members = await readMembers();
  const admin = await requireAdmin(requesterId, members);
  if (!admin) {
    res.status(403).json({ error: "Sem permissão" });
    return;
  }
  const { id } = req.params;
  const target = members.find((m) => m.id === id);
  if (!target) {
    res.status(404).json({ error: "Membro não encontrado" });
    return;
  }
  const next = members.map((m) =>
    m.id === id
      ? {
          ...m,
          status: "active" as const,
          approvedAt: new Date().toISOString(),
          approvedById: admin.id,
        }
      : m,
  );
  await writeMembers(next);
  const updated = next.find((m) => m.id === id)!;
  res.json({ member: sanitize(updated) });
});

router.delete("/auth/members/:id", async (req, res) => {
  const requesterId = req.headers["x-member-id"] as string | undefined;
  const members = await readMembers();
  const admin = await requireAdmin(requesterId, members);
  if (!admin) {
    res.status(403).json({ error: "Sem permissão" });
    return;
  }
  const { id } = req.params;
  if (id === admin.id) {
    res.status(400).json({ error: "Não podes remover a tua própria conta" });
    return;
  }
  const target = members.find((m) => m.id === id);
  if (!target) {
    res.status(404).json({ error: "Membro não encontrado" });
    return;
  }
  if (target.isAdmin) {
    const remainingAdmins = members.filter(
      (m) => m.status === "active" && m.isAdmin && m.id !== id,
    ).length;
    if (remainingAdmins === 0) {
      res
        .status(400)
        .json({ error: "Não podes remover o único administrador" });
      return;
    }
  }
  await writeMembers(members.filter((m) => m.id !== id));
  res.json({ ok: true });
});

router.post("/auth/members/:id/toggle-admin", async (req, res) => {
  const requesterId = req.headers["x-member-id"] as string | undefined;
  const members = await readMembers();
  const admin = await requireAdmin(requesterId, members);
  if (!admin) {
    res.status(403).json({ error: "Sem permissão" });
    return;
  }
  const { id } = req.params;
  const target = members.find((m) => m.id === id);
  if (!target || target.status !== "active") {
    res.status(404).json({ error: "Membro não encontrado" });
    return;
  }
  if (target.isAdmin) {
    const remainingAdmins = members.filter(
      (m) => m.status === "active" && m.isAdmin && m.id !== id,
    ).length;
    if (remainingAdmins === 0) {
      res
        .status(400)
        .json({ error: "Não podes remover o último administrador" });
      return;
    }
  }
  const next = members.map((m) =>
    m.id === id ? { ...m, isAdmin: !m.isAdmin } : m,
  );
  await writeMembers(next);
  const updated = next.find((m) => m.id === id)!;
  res.json({ member: sanitize(updated) });
});

router.post("/auth/members/:id/categories", async (req, res) => {
  const requesterId = req.headers["x-member-id"] as string | undefined;
  const { categories } = req.body ?? {};
  const members = await readMembers();
  const requester = await requireMember(requesterId, members);
  if (!requester) {
    res.status(403).json({ error: "Sem permissão" });
    return;
  }
  const { id } = req.params;
  if (id !== requester.id && !requester.isAdmin) {
    res.status(403).json({ error: "Sem permissão" });
    return;
  }
  if (!Array.isArray(categories)) {
    res.status(400).json({ error: "categories inválidas" });
    return;
  }
  const validCats = (categories as string[]).filter((c): c is CrewCategory =>
    ALL_CREW_CATEGORIES.includes(c as CrewCategory),
  );
  const next = members.map((m) =>
    m.id === id ? { ...m, categories: validCats } : m,
  );
  await writeMembers(next);
  const updated = next.find((m) => m.id === id)!;
  res.json({ member: sanitize(updated) });
});

router.post("/auth/change-password", async (req, res) => {
  const requesterId = req.headers["x-member-id"] as string | undefined;
  const { current, next: nextPassword } = req.body ?? {};
  const members = await readMembers();
  const member = members.find((m) => m.id === requesterId);
  if (!member || member.status !== "active") {
    res.status(403).json({ error: "Sessão inválida" });
    return;
  }
  if (!verifyPassword(current, member.passwordHash)) {
    res.status(401).json({ error: "Password atual incorreta" });
    return;
  }
  if (!nextPassword || nextPassword.length < 4) {
    res
      .status(400)
      .json({ error: "A nova password tem de ter pelo menos 4 caracteres" });
    return;
  }
  if (current === nextPassword) {
    res
      .status(400)
      .json({ error: "A nova password tem de ser diferente da atual" });
    return;
  }
  const updated: CrewMember = { ...member, passwordHash: hashPassword(nextPassword) };
  await writeMembers(members.map((m) => (m.id === member.id ? updated : m)));
  res.json({ ok: true, member: sanitize(updated) });
});

export default router;
