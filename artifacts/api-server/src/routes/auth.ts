import { Router } from "express";
import { hashPassword, verifyPassword } from "../lib/hash";
import {
  type CrewCategory,
  createMember,
  deleteMember,
  findMemberById,
  findMemberByCrewId,
  readMembers,
  sanitize,
  updateMember,
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

router.get("/auth/status", async (_req, res) => {
  const members = await readMembers();
  const hasAdmin = members.some((m) => m.status === "active" && m.isAdmin);
  res.json({ hasAdmin });
});

router.post("/auth/signin", async (req, res) => {
  const { crewId, password } = req.body ?? {};
  if (!crewId || !password) {
    res.status(400).json({ error: "crewId e password obrigatórios" }); return;
  }
  const found = await findMemberByCrewId(normalizeCrewId(crewId));
  if (!found) { res.status(401).json({ error: "Nº Tripulante não encontrado" }); return; }
  if (!verifyPassword(password, found.passwordHash)) {
    res.status(401).json({ error: "Password incorreta" }); return;
  }
  if (found.status === "pending") {
    res.status(403).json({ error: "Conta ainda não aprovada por um tripulante autorizado" }); return;
  }
  res.json({ member: sanitize(found) });
});

router.post("/auth/register", async (req, res) => {
  const { name, crewId, password, categories } = req.body ?? {};
  if (!name?.trim()) { res.status(400).json({ error: "Indica o teu nome" }); return; }
  if (!crewId?.trim()) { res.status(400).json({ error: "Indica o teu Nº Tripulante" }); return; }
  if (!password || password.length < 4) {
    res.status(400).json({ error: "Password tem de ter pelo menos 4 caracteres" }); return;
  }
  if (!Array.isArray(categories) || categories.length === 0) {
    res.status(400).json({ error: "Seleciona pelo menos uma categoria" }); return;
  }
  const validCats = (categories as string[]).filter((c): c is CrewCategory =>
    ALL_CREW_CATEGORIES.includes(c as CrewCategory),
  );
  const existing = await findMemberByCrewId(normalizeCrewId(crewId));
  if (existing) {
    res.status(409).json({ error: "Já existe um pedido com este Nº Tripulante" }); return;
  }
  const members = await readMembers();
  const hasActiveAdmin = members.some((m) => m.status === "active" && m.isAdmin);
  const autoActivated = !hasActiveAdmin;
  const created = await createMember({
    name: name.trim(),
    crewId: crewId.trim(),
    passwordHash: hashPassword(password),
    status: autoActivated ? "active" : "pending",
    isAdmin: autoActivated,
    categories: validCats,
    approvedAt: autoActivated ? new Date().toISOString() : undefined,
  });
  res.status(201).json({ member: sanitize(created), autoActivated });
});

router.get("/auth/members", async (req, res) => {
  const requesterId = req.headers["x-member-id"] as string | undefined;
  if (!requesterId) { res.status(403).json({ error: "Sem permissão" }); return; }
  const admin = await findMemberById(requesterId);
  if (!admin || admin.status !== "active" || !admin.isAdmin) {
    res.status(403).json({ error: "Sem permissão" }); return;
  }
  const members = await readMembers();
  res.json({ members: members.map(sanitize) });
});

router.get("/auth/me", async (req, res) => {
  const memberId = req.headers["x-member-id"] as string | undefined;
  if (!memberId) { res.status(404).json({ error: "Membro não encontrado" }); return; }
  const found = await findMemberById(memberId);
  if (!found) { res.status(404).json({ error: "Membro não encontrado" }); return; }
  res.json({ member: sanitize(found) });
});

router.post("/auth/members/:id/approve", async (req, res) => {
  const requesterId = req.headers["x-member-id"] as string | undefined;
  if (!requesterId) { res.status(403).json({ error: "Sem permissão" }); return; }
  const admin = await findMemberById(requesterId);
  if (!admin || admin.status !== "active" || !admin.isAdmin) {
    res.status(403).json({ error: "Sem permissão" }); return;
  }
  const target = await findMemberById(req.params.id);
  if (!target) { res.status(404).json({ error: "Membro não encontrado" }); return; }
  const updated = await updateMember(req.params.id, {
    status: "active",
    approvedAt: new Date().toISOString(),
    approvedById: admin.id,
  });
  res.json({ member: sanitize(updated!) });
});

router.delete("/auth/members/:id", async (req, res) => {
  const requesterId = req.headers["x-member-id"] as string | undefined;
  if (!requesterId) { res.status(403).json({ error: "Sem permissão" }); return; }
  const admin = await findMemberById(requesterId);
  if (!admin || admin.status !== "active" || !admin.isAdmin) {
    res.status(403).json({ error: "Sem permissão" }); return;
  }
  const { id } = req.params;
  if (id === admin.id) { res.status(400).json({ error: "Não podes remover a tua própria conta" }); return; }
  const target = await findMemberById(id);
  if (!target) { res.status(404).json({ error: "Membro não encontrado" }); return; }
  if (target.isAdmin) {
    const members = await readMembers();
    const remainingAdmins = members.filter((m) => m.status === "active" && m.isAdmin && m.id !== id).length;
    if (remainingAdmins === 0) {
      res.status(400).json({ error: "Não podes remover o único administrador" }); return;
    }
  }
  await deleteMember(id);
  res.json({ ok: true });
});

router.post("/auth/members/:id/toggle-admin", async (req, res) => {
  const requesterId = req.headers["x-member-id"] as string | undefined;
  if (!requesterId) { res.status(403).json({ error: "Sem permissão" }); return; }
  const admin = await findMemberById(requesterId);
  if (!admin || admin.status !== "active" || !admin.isAdmin) {
    res.status(403).json({ error: "Sem permissão" }); return;
  }
  const target = await findMemberById(req.params.id);
  if (!target || target.status !== "active") {
    res.status(404).json({ error: "Membro não encontrado" }); return;
  }
  if (target.isAdmin) {
    const members = await readMembers();
    const remainingAdmins = members.filter((m) => m.status === "active" && m.isAdmin && m.id !== req.params.id).length;
    if (remainingAdmins === 0) {
      res.status(400).json({ error: "Não podes remover o último administrador" }); return;
    }
  }
  const updated = await updateMember(req.params.id, { isAdmin: !target.isAdmin });
  res.json({ member: sanitize(updated!) });
});

router.post("/auth/members/:id/categories", async (req, res) => {
  const requesterId = req.headers["x-member-id"] as string | undefined;
  if (!requesterId) { res.status(403).json({ error: "Sem permissão" }); return; }
  const requester = await findMemberById(requesterId);
  if (!requester || requester.status !== "active") {
    res.status(403).json({ error: "Sem permissão" }); return;
  }
  const { id } = req.params;
  if (id !== requester.id && !requester.isAdmin) {
    res.status(403).json({ error: "Sem permissão" }); return;
  }
  const { categories, categoryOtherLabel } = req.body ?? {};
  if (!Array.isArray(categories)) { res.status(400).json({ error: "categories inválidas" }); return; }
  const validCats = (categories as string[]).filter((c): c is CrewCategory =>
    ALL_CREW_CATEGORIES.includes(c as CrewCategory),
  );
  const otherLabel = validCats.includes("outro")
    ? (typeof categoryOtherLabel === "string" ? categoryOtherLabel.trim() : undefined) ?? null
    : null;
  const updated = await updateMember(id, {
    categories: validCats,
    categoryOtherLabel: otherLabel ?? undefined,
  });
  res.json({ member: sanitize(updated!) });
});

router.patch("/auth/name", async (req, res) => {
  const requesterId = req.headers["x-member-id"] as string | undefined;
  if (!requesterId) { res.status(403).json({ error: "Sessão inválida" }); return; }
  const member = await findMemberById(requesterId);
  if (!member || member.status !== "active") { res.status(403).json({ error: "Sessão inválida" }); return; }
  const { name } = req.body ?? {};
  if (!name?.trim()) { res.status(400).json({ error: "O nome não pode ser vazio" }); return; }
  const updated = await updateMember(requesterId, { name: name.trim() });
  res.json({ member: sanitize(updated!) });
});

router.patch("/auth/members/:id/name", async (req, res) => {
  const requesterId = req.headers["x-member-id"] as string | undefined;
  if (!requesterId) { res.status(403).json({ error: "Sem permissão" }); return; }
  const admin = await findMemberById(requesterId);
  if (!admin || admin.status !== "active" || !admin.isAdmin) { res.status(403).json({ error: "Sem permissão" }); return; }
  const target = await findMemberById(req.params.id);
  if (!target) { res.status(404).json({ error: "Membro não encontrado" }); return; }
  const { name } = req.body ?? {};
  if (!name?.trim()) { res.status(400).json({ error: "O nome não pode ser vazio" }); return; }
  const updated = await updateMember(req.params.id, { name: name.trim() });
  res.json({ member: sanitize(updated!) });
});

router.patch("/auth/folga-group", async (req, res) => {
  const requesterId = req.headers["x-member-id"] as string | undefined;
  if (!requesterId) { res.status(403).json({ error: "Sessão inválida" }); return; }
  const member = await findMemberById(requesterId);
  if (!member || member.status !== "active") { res.status(403).json({ error: "Sessão inválida" }); return; }
  const { folgaGroup } = req.body ?? {};
  const trimmed = folgaGroup?.trim() ?? "";
  const updated = await updateMember(requesterId, { folgaGroup: trimmed || (null as any) });
  res.json({ member: sanitize(updated!) });
});

router.patch("/auth/nickname", async (req, res) => {
  const requesterId = req.headers["x-member-id"] as string | undefined;
  if (!requesterId) { res.status(403).json({ error: "Sessão inválida" }); return; }
  const member = await findMemberById(requesterId);
  if (!member || member.status !== "active") { res.status(403).json({ error: "Sessão inválida" }); return; }
  const { nickname } = req.body ?? {};
  const trimmed = nickname?.trim() ?? "";
  const updated = await updateMember(requesterId, { nickname: trimmed || null as any });
  res.json({ member: sanitize(updated!) });
});

router.post("/auth/change-password", async (req, res) => {
  const requesterId = req.headers["x-member-id"] as string | undefined;
  if (!requesterId) { res.status(403).json({ error: "Sessão inválida" }); return; }
  const member = await findMemberById(requesterId);
  if (!member || member.status !== "active") { res.status(403).json({ error: "Sessão inválida" }); return; }
  const { current, next: nextPassword } = req.body ?? {};
  if (!verifyPassword(current, member.passwordHash)) {
    res.status(401).json({ error: "Password atual incorreta" }); return;
  }
  if (!nextPassword || nextPassword.length < 4) {
    res.status(400).json({ error: "A nova password tem de ter pelo menos 4 caracteres" }); return;
  }
  if (current === nextPassword) {
    res.status(400).json({ error: "A nova password tem de ser diferente da atual" }); return;
  }
  const updated = await updateMember(requesterId, { passwordHash: hashPassword(nextPassword) });
  res.json({ ok: true, member: sanitize(updated!) });
});

export default router;
