import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { broadcast } from "../lib/sse";
import { newId } from "../lib/id";
import { readMembers } from "../lib/store";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "breakdowns.json");
const REQUIRED_CONFIRMATIONS = 2;
const MAX_PHOTOS = 3;
const PHOTO_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

export interface Confirmation {
  crewMemberId: string;
  crewMemberName: string;
  crewIdLabel: string;
  at: string;
}

export interface BreakdownPhoto {
  id: string;
  uri: string;
  addedAt: string;
  addedById: string;
  addedByName: string;
}

export interface Breakdown {
  id: string;
  vehicleKind: string;
  fleetNumber: string;
  description: string;
  reportedById: string;
  reportedByName: string;
  reportedByCrewId: string;
  reportedAt: string;
  confirmations: Confirmation[];
  photos: BreakdownPhoto[];
}

async function readBreakdowns(): Promise<Breakdown[]> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as Breakdown[];
  } catch {
    return [];
  }
}

async function writeBreakdowns(items: Breakdown[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const now = Date.now();
  const pruned = items.map((b) => ({
    ...b,
    photos: b.photos.filter(
      (p) => now - new Date(p.addedAt).getTime() < PHOTO_LIFETIME_MS,
    ),
  }));
  await fs.writeFile(FILE, JSON.stringify(pruned, null, 2), "utf8");
}

async function requireActiveMember(
  memberId: string | undefined,
  members: Awaited<ReturnType<typeof readMembers>>,
) {
  if (!memberId) return null;
  const m = members.find((x) => x.id === memberId && x.status === "active");
  return m ?? null;
}

const router = Router();

router.get("/breakdowns", async (req, res) => {
  const memberId = req.headers["x-member-id"] as string | undefined;
  const members = await readMembers();
  const member = await requireActiveMember(memberId, members);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const items = await readBreakdowns();
  res.json({ breakdowns: items });
});

router.post("/breakdowns", async (req, res) => {
  const memberId = req.headers["x-member-id"] as string | undefined;
  const members = await readMembers();
  const member = await requireActiveMember(memberId, members);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const { vehicleKind, fleetNumber, description } = req.body ?? {};
  if (!vehicleKind || !fleetNumber?.trim() || !description?.trim()) {
    res.status(400).json({ error: "Campos obrigatórios em falta" }); return;
  }
  const created: Breakdown = {
    id: newId(),
    vehicleKind,
    fleetNumber: String(fleetNumber).trim(),
    description: String(description).trim(),
    reportedById: member.id,
    reportedByName: member.name,
    reportedByCrewId: member.crewId,
    reportedAt: new Date().toISOString(),
    confirmations: [],
    photos: [],
  };
  const items = await readBreakdowns();
  await writeBreakdowns([created, ...items]);
  broadcast("breakdowns");
  res.status(201).json({ breakdown: created });
});

router.post("/breakdowns/:id/confirm", async (req, res) => {
  const memberId = req.headers["x-member-id"] as string | undefined;
  const members = await readMembers();
  const member = await requireActiveMember(memberId, members);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const items = await readBreakdowns();
  const target = items.find((b) => b.id === req.params.id);
  if (!target) { res.status(404).json({ error: "Avaria não encontrada" }); return; }
  if (target.reportedById === member.id) {
    res.status(400).json({ error: "Quem reportou não pode validar a sua própria avaria" }); return;
  }
  if (target.confirmations.some((c) => c.crewMemberId === member.id)) {
    res.status(400).json({ error: "Já validaste esta avaria" }); return;
  }
  if (target.confirmations.length >= REQUIRED_CONFIRMATIONS) {
    res.status(400).json({ error: "Avaria já resolvida" }); return;
  }
  const updated = {
    ...target,
    confirmations: [
      ...target.confirmations,
      { crewMemberId: member.id, crewMemberName: member.name, crewIdLabel: member.crewId, at: new Date().toISOString() },
    ],
  };
  await writeBreakdowns(items.map((b) => (b.id === req.params.id ? updated : b)));
  broadcast("breakdowns");
  res.json({ breakdown: updated });
});

router.delete("/breakdowns/:id", async (req, res) => {
  const memberId = req.headers["x-member-id"] as string | undefined;
  const members = await readMembers();
  const member = await requireActiveMember(memberId, members);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const items = await readBreakdowns();
  const target = items.find((b) => b.id === req.params.id);
  if (!target) { res.status(404).json({ error: "Avaria não encontrada" }); return; }
  if (target.reportedById !== member.id && !member.isAdmin) {
    res.status(403).json({ error: "Sem permissão" }); return;
  }
  await writeBreakdowns(items.filter((b) => b.id !== req.params.id));
  broadcast("breakdowns");
  res.json({ ok: true });
});

router.post("/breakdowns/:id/photos", async (req, res) => {
  const memberId = req.headers["x-member-id"] as string | undefined;
  const members = await readMembers();
  const member = await requireActiveMember(memberId, members);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const { uri } = req.body ?? {};
  if (!uri) { res.status(400).json({ error: "URI obrigatória" }); return; }
  const items = await readBreakdowns();
  const target = items.find((b) => b.id === req.params.id);
  if (!target) { res.status(404).json({ error: "Avaria não encontrada" }); return; }
  if (target.photos.length >= MAX_PHOTOS) {
    res.status(400).json({ error: `Máximo de ${MAX_PHOTOS} fotografias por avaria` }); return;
  }
  const photo: BreakdownPhoto = {
    id: newId(), uri, addedAt: new Date().toISOString(),
    addedById: member.id, addedByName: member.name,
  };
  const updated = { ...target, photos: [photo, ...target.photos] };
  await writeBreakdowns(items.map((b) => (b.id === req.params.id ? updated : b)));
  broadcast("breakdowns");
  res.json({ breakdown: updated });
});

router.delete("/breakdowns/:id/photos/:photoId", async (req, res) => {
  const memberId = req.headers["x-member-id"] as string | undefined;
  const members = await readMembers();
  const member = await requireActiveMember(memberId, members);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const items = await readBreakdowns();
  const target = items.find((b) => b.id === req.params.id);
  if (!target) { res.status(404).json({ error: "Avaria não encontrada" }); return; }
  const updated = { ...target, photos: target.photos.filter((p) => p.id !== req.params.photoId) };
  await writeBreakdowns(items.map((b) => (b.id === req.params.id ? updated : b)));
  broadcast("breakdowns");
  res.json({ breakdown: updated });
});

export default router;
