import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { broadcast } from "../lib/sse";
import { newId } from "../lib/id";
import { readMembers } from "../lib/store";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "shifts.json");

export interface ShiftStop {
  location: string;
  time: string;
}

export interface Shift {
  id: string;
  crewMemberId: string;
  date: string;
  code?: string;
  vehicleCode?: string;
  affectation: string;
  affectationLabel?: string;
  stops: ShiftStop[];
  notes?: string;
  availableForSwap?: boolean;
  createdAt: string;
}

async function readShifts(): Promise<Shift[]> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as Shift[];
  } catch {
    return [];
  }
}

async function writeShifts(items: Shift[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(items, null, 2), "utf8");
}

async function requireActiveMember(
  memberId: string | undefined,
  members: Awaited<ReturnType<typeof readMembers>>,
) {
  if (!memberId) return null;
  return members.find((x) => x.id === memberId && x.status === "active") ?? null;
}

const ABSENCE_TYPES = new Set(["folga", "ferias"]);

const router = Router();

router.get("/shifts", async (req, res) => {
  const memberId = req.headers["x-member-id"] as string | undefined;
  const members = await readMembers();
  const member = await requireActiveMember(memberId, members);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const all = await readShifts();
  const mine = all.filter((s) => s.crewMemberId === member.id);
  res.json({ shifts: mine });
});

router.get("/shifts/all", async (req, res) => {
  const memberId = req.headers["x-member-id"] as string | undefined;
  const members = await readMembers();
  const member = await requireActiveMember(memberId, members);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const all = await readShifts();
  res.json({ shifts: all });
});

router.post("/shifts", async (req, res) => {
  const memberId = req.headers["x-member-id"] as string | undefined;
  const members = await readMembers();
  const member = await requireActiveMember(memberId, members);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }

  const body = req.body as Omit<Shift, "id" | "crewMemberId" | "createdAt">;
  if (!body.date || !body.affectation || !Array.isArray(body.stops)) {
    res.status(400).json({ error: "Dados em falta" }); return;
  }

  const all = await readShifts();
  const mine = all.filter((s) => s.crewMemberId === member.id);

  const startTime = body.stops[0]?.time ?? "";
  const endTime = body.stops[body.stops.length - 1]?.time ?? "";

  let duplicate: Shift | undefined;
  if (ABSENCE_TYPES.has(body.affectation)) {
    duplicate = mine.find(
      (s) => s.date === body.date && s.affectation === body.affectation,
    );
  } else {
    duplicate = mine.find(
      (s) =>
        s.date === body.date &&
        !ABSENCE_TYPES.has(s.affectation) &&
        (s.stops[0]?.time ?? "") === startTime &&
        (s.stops[s.stops.length - 1]?.time ?? "") === endTime,
    );
  }

  if (duplicate) {
    res.status(409).json({ error: "Já existe um serviço neste dia com as mesmas horas de início e fim." });
    return;
  }

  const created: Shift = {
    ...body,
    id: newId(),
    crewMemberId: member.id,
    createdAt: new Date().toISOString(),
  };
  await writeShifts([created, ...all]);
  broadcast("shifts");
  res.status(201).json({ shift: created });
});

router.put("/shifts/:id", async (req, res) => {
  const memberId = req.headers["x-member-id"] as string | undefined;
  const members = await readMembers();
  const member = await requireActiveMember(memberId, members);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }

  const all = await readShifts();
  const existing = all.find((s) => s.id === req.params.id);
  if (!existing) { res.status(404).json({ error: "Serviço não encontrado" }); return; }
  if (existing.crewMemberId !== member.id) {
    res.status(403).json({ error: "Sem permissão para editar este serviço" }); return;
  }

  const body = req.body as Omit<Shift, "id" | "crewMemberId" | "createdAt">;
  const mine = all.filter((s) => s.crewMemberId === member.id);
  const startTime = body.stops[0]?.time ?? "";
  const endTime = body.stops[body.stops.length - 1]?.time ?? "";

  let duplicate: Shift | undefined;
  if (ABSENCE_TYPES.has(body.affectation)) {
    duplicate = mine.find(
      (s) => s.id !== req.params.id && s.date === body.date && s.affectation === body.affectation,
    );
  } else {
    duplicate = mine.find(
      (s) =>
        s.id !== req.params.id &&
        s.date === body.date &&
        !ABSENCE_TYPES.has(s.affectation) &&
        (s.stops[0]?.time ?? "") === startTime &&
        (s.stops[s.stops.length - 1]?.time ?? "") === endTime,
    );
  }

  if (duplicate) {
    res.status(409).json({ error: "Já existe outro serviço neste dia com as mesmas horas de início e fim." });
    return;
  }

  const updated: Shift = { ...existing, ...body, id: existing.id, crewMemberId: existing.crewMemberId, createdAt: existing.createdAt };
  await writeShifts(all.map((s) => (s.id === req.params.id ? updated : s)));
  broadcast("shifts");
  res.json({ shift: updated });
});

router.delete("/shifts/:id", async (req, res) => {
  const memberId = req.headers["x-member-id"] as string | undefined;
  const members = await readMembers();
  const member = await requireActiveMember(memberId, members);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }

  const all = await readShifts();
  const existing = all.find((s) => s.id === req.params.id);
  if (!existing) { res.status(404).json({ error: "Serviço não encontrado" }); return; }
  if (existing.crewMemberId !== member.id && !member.isAdmin) {
    res.status(403).json({ error: "Sem permissão" }); return;
  }
  await writeShifts(all.filter((s) => s.id !== req.params.id));
  broadcast("shifts");
  res.json({ ok: true });
});

router.patch("/shifts/:id/swap-available", async (req, res) => {
  const memberId = req.headers["x-member-id"] as string | undefined;
  const members = await readMembers();
  const member = await requireActiveMember(memberId, members);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }

  const all = await readShifts();
  const existing = all.find((s) => s.id === req.params.id);
  if (!existing) { res.status(404).json({ error: "Serviço não encontrado" }); return; }
  if (existing.crewMemberId !== member.id) {
    res.status(403).json({ error: "Sem permissão" }); return;
  }
  const available = Boolean(req.body?.available);
  const updated = { ...existing, availableForSwap: available };
  await writeShifts(all.map((s) => (s.id === req.params.id ? updated : s)));
  broadcast("shifts");
  res.json({ shift: updated });
});

router.post("/shifts/swap-available/bulk", async (req, res) => {
  const memberId = req.headers["x-member-id"] as string | undefined;
  const members = await readMembers();
  const member = await requireActiveMember(memberId, members);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }

  const { ids, available } = req.body ?? {};
  if (!Array.isArray(ids)) { res.status(400).json({ error: "ids obrigatório" }); return; }
  const idSet = new Set<string>(ids);
  const all = await readShifts();
  const next = all.map((s) =>
    idSet.has(s.id) && s.crewMemberId === member.id
      ? { ...s, availableForSwap: Boolean(available) }
      : s,
  );
  await writeShifts(next);
  broadcast("shifts");
  res.json({ ok: true });
});

export default router;
