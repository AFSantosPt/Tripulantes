import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { broadcast } from "../lib/sse";
import { newId } from "../lib/id";
import { readMembers } from "../lib/store";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "swaps.json");

export type SwapStatus = "pending" | "confirmed" | "rejected";

export interface OfferShiftSnapshot {
  id: string;
  code?: string;
  vehicleCode?: string;
  stops: { location: string; time: string }[];
}

export interface SwapRequest {
  id: string;
  offerShiftId: string;
  offerShiftIds: string[];
  offerShifts: OfferShiftSnapshot[];
  offererId: string;
  offererName: string;
  offererCrewId: string;
  offererCategories: string[];
  offerShiftDate: string;
  offerShiftCode?: string;
  offerShiftStart: string;
  offerShiftEnd: string;
  offerShiftStops: { location: string; time: string }[];
  offerShiftVehicle?: string;
  requesterId: string;
  requesterName: string;
  requesterCrewId: string;
  requesterCategories: string[];
  status: SwapStatus;
  createdAt: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readSwaps(): Promise<SwapRequest[]> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as SwapRequest[];
    const today = todayIso();
    return parsed.filter((r) => r.offerShiftDate >= today);
  } catch {
    return [];
  }
}

async function writeSwaps(items: SwapRequest[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const today = todayIso();
  const fresh = items.filter((r) => r.offerShiftDate >= today);
  await fs.writeFile(FILE, JSON.stringify(fresh, null, 2), "utf8");
}

async function requireActiveMember(
  memberId: string | undefined,
  members: Awaited<ReturnType<typeof readMembers>>,
) {
  if (!memberId) return null;
  return members.find((x) => x.id === memberId && x.status === "active") ?? null;
}

const router = Router();

router.get("/swaps", async (req, res) => {
  const memberId = req.headers["x-member-id"] as string | undefined;
  const members = await readMembers();
  const member = await requireActiveMember(memberId, members);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const items = await readSwaps();
  res.json({ swapRequests: items });
});

router.post("/swaps", async (req, res) => {
  const memberId = req.headers["x-member-id"] as string | undefined;
  const members = await readMembers();
  const member = await requireActiveMember(memberId, members);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const body = req.body as Omit<SwapRequest, "id" | "requesterId" | "requesterName" | "requesterCrewId" | "requesterCategories" | "status" | "createdAt">;
  if (!body.offererId || !body.offerShiftDate) {
    res.status(400).json({ error: "Dados em falta" }); return;
  }
  if (body.offererId === member.id) {
    res.status(400).json({ error: "Não podes trocar contigo próprio" }); return;
  }
  const items = await readSwaps();
  const shiftIds: string[] = body.offerShiftIds ?? (body.offerShiftId ? [body.offerShiftId] : []);
  const existing = items.find(
    (r) => r.offerShiftIds.some((id) => shiftIds.includes(id)) && r.requesterId === member.id && r.status === "pending",
  );
  if (existing) {
    res.status(409).json({ error: "Já enviaste um pedido para este serviço" }); return;
  }
  const req2: SwapRequest = {
    ...body,
    id: newId(),
    offerShiftId: body.offerShiftId ?? shiftIds[0] ?? "",
    offerShiftIds: shiftIds,
    requesterId: member.id,
    requesterName: member.name,
    requesterCrewId: member.crewId,
    requesterCategories: member.categories,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  await writeSwaps([...items, req2]);
  broadcast("swaps");
  res.status(201).json({ swapRequest: req2 });
});

router.post("/swaps/:id/confirm", async (req, res) => {
  const memberId = req.headers["x-member-id"] as string | undefined;
  const members = await readMembers();
  const member = await requireActiveMember(memberId, members);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const items = await readSwaps();
  const target = items.find((r) => r.id === req.params.id);
  if (!target) { res.status(404).json({ error: "Pedido não encontrado" }); return; }
  if (target.offererId !== member.id) { res.status(403).json({ error: "Sem permissão" }); return; }
  if (target.status !== "pending") { res.status(400).json({ error: "Pedido já processado" }); return; }
  const updated = { ...target, status: "confirmed" as const };
  await writeSwaps(items.map((r) => (r.id === req.params.id ? updated : r)));
  broadcast("swaps");
  res.json({ swapRequest: updated });
});

router.post("/swaps/:id/reject", async (req, res) => {
  const memberId = req.headers["x-member-id"] as string | undefined;
  const members = await readMembers();
  const member = await requireActiveMember(memberId, members);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const items = await readSwaps();
  const target = items.find((r) => r.id === req.params.id);
  if (!target) { res.status(404).json({ error: "Pedido não encontrado" }); return; }
  if (target.offererId !== member.id) { res.status(403).json({ error: "Sem permissão" }); return; }
  if (target.status !== "pending") { res.status(400).json({ error: "Pedido já processado" }); return; }
  const updated = { ...target, status: "rejected" as const };
  await writeSwaps(items.map((r) => (r.id === req.params.id ? updated : r)));
  broadcast("swaps");
  res.json({ swapRequest: updated });
});

router.delete("/swaps/:id", async (req, res) => {
  const memberId = req.headers["x-member-id"] as string | undefined;
  const members = await readMembers();
  const member = await requireActiveMember(memberId, members);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const items = await readSwaps();
  const target = items.find((r) => r.id === req.params.id);
  if (!target) { res.status(404).json({ error: "Pedido não encontrado" }); return; }
  if (target.requesterId !== member.id && !member.isAdmin) {
    res.status(403).json({ error: "Sem permissão" }); return;
  }
  await writeSwaps(items.filter((r) => r.id !== req.params.id));
  broadcast("swaps");
  res.json({ ok: true });
});

export default router;
