import { Router } from "express";
import pool from "../lib/db";
import { newId } from "../lib/id";
import { broadcast } from "../lib/sse";
import { findMemberById } from "../lib/store";

export type SwapStatus = "pending" | "confirmed" | "rejected";

function todayIso(): string { return new Date().toISOString().slice(0, 10); }

function rowToSwap(row: any) {
  return {
    id: row.id,
    offerShiftId: row.offer_shift_id,
    offerShiftIds: row.offer_shift_ids ?? [],
    offerShifts: row.offer_shifts ?? [],
    offererId: row.offerer_id,
    offererName: row.offerer_name,
    offererCrewId: row.offerer_crew_id,
    offererCategories: row.offerer_categories ?? [],
    offerShiftDate: row.offer_shift_date,
    offerShiftCode: row.offer_shift_code ?? undefined,
    offerShiftStart: row.offer_shift_start,
    offerShiftEnd: row.offer_shift_end,
    offerShiftStops: row.offer_shift_stops ?? [],
    offerShiftVehicle: row.offer_shift_vehicle ?? undefined,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    requesterCrewId: row.requester_crew_id,
    requesterCategories: row.requester_categories ?? [],
    status: row.status as SwapStatus,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

async function requireActiveMember(memberId: string | undefined) {
  if (!memberId) return null;
  const m = await findMemberById(memberId);
  return m?.status === "active" ? m : null;
}

const router = Router();

router.get("/swaps", async (req, res) => {
  const member = await requireActiveMember(req.headers["x-member-id"] as string);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const r = await pool.query(
    "SELECT * FROM swaps WHERE offer_shift_date >= $1 ORDER BY created_at DESC",
    [todayIso()],
  );
  res.json({ swapRequests: r.rows.map(rowToSwap) });
});

router.post("/swaps", async (req, res) => {
  const member = await requireActiveMember(req.headers["x-member-id"] as string);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const body = req.body;
  if (!body.offererId || !body.offerShiftDate) { res.status(400).json({ error: "Dados em falta" }); return; }
  if (body.offererId === member.id) { res.status(400).json({ error: "Não podes trocar contigo próprio" }); return; }
  const shiftIds: string[] = body.offerShiftIds ?? (body.offerShiftId ? [body.offerShiftId] : []);
  if (shiftIds.length > 0) {
    const dup = await pool.query(
      "SELECT id FROM swaps WHERE requester_id=$1 AND status='pending' AND offer_shift_ids && $2::text[]",
      [member.id, shiftIds],
    );
    if (dup.rows.length > 0) { res.status(409).json({ error: "Já enviaste um pedido para este serviço" }); return; }
  }
  const id = newId();
  const r = await pool.query(
    `INSERT INTO swaps (id,offer_shift_id,offer_shift_ids,offer_shifts,offerer_id,offerer_name,offerer_crew_id,offerer_categories,
     offer_shift_date,offer_shift_code,offer_shift_start,offer_shift_end,offer_shift_stops,offer_shift_vehicle,
     requester_id,requester_name,requester_crew_id,requester_categories,status,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'pending',NOW()) RETURNING *`,
    [id, body.offerShiftId ?? shiftIds[0] ?? "", shiftIds, JSON.stringify(body.offerShifts ?? []),
     body.offererId, body.offererName, body.offererCrewId, body.offererCategories ?? [],
     body.offerShiftDate, body.offerShiftCode ?? null, body.offerShiftStart, body.offerShiftEnd,
     JSON.stringify(body.offerShiftStops ?? []), body.offerShiftVehicle ?? null,
     member.id, member.name, member.crewId, member.categories ?? []],
  );
  broadcast("swaps");
  res.status(201).json({ swapRequest: rowToSwap(r.rows[0]) });
});

router.post("/swaps/:id/confirm", async (req, res) => {
  const member = await requireActiveMember(req.headers["x-member-id"] as string);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const existing = await pool.query("SELECT * FROM swaps WHERE id=$1", [req.params.id]);
  if (!existing.rows[0]) { res.status(404).json({ error: "Pedido não encontrado" }); return; }
  if (existing.rows[0].offerer_id !== member.id) { res.status(403).json({ error: "Sem permissão" }); return; }
  if (existing.rows[0].status !== "pending") { res.status(400).json({ error: "Pedido já processado" }); return; }
  const r = await pool.query("UPDATE swaps SET status='confirmed' WHERE id=$1 RETURNING *", [req.params.id]);
  broadcast("swaps");
  res.json({ swapRequest: rowToSwap(r.rows[0]) });
});

router.post("/swaps/:id/reject", async (req, res) => {
  const member = await requireActiveMember(req.headers["x-member-id"] as string);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const existing = await pool.query("SELECT * FROM swaps WHERE id=$1", [req.params.id]);
  if (!existing.rows[0]) { res.status(404).json({ error: "Pedido não encontrado" }); return; }
  if (existing.rows[0].offerer_id !== member.id) { res.status(403).json({ error: "Sem permissão" }); return; }
  if (existing.rows[0].status !== "pending") { res.status(400).json({ error: "Pedido já processado" }); return; }
  const r = await pool.query("UPDATE swaps SET status='rejected' WHERE id=$1 RETURNING *", [req.params.id]);
  broadcast("swaps");
  res.json({ swapRequest: rowToSwap(r.rows[0]) });
});

router.delete("/swaps/:id", async (req, res) => {
  const member = await requireActiveMember(req.headers["x-member-id"] as string);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const existing = await pool.query("SELECT * FROM swaps WHERE id=$1", [req.params.id]);
  if (!existing.rows[0]) { res.status(404).json({ error: "Pedido não encontrado" }); return; }
  if (existing.rows[0].requester_id !== member.id && !member.isAdmin) { res.status(403).json({ error: "Sem permissão" }); return; }
  await pool.query("DELETE FROM swaps WHERE id=$1", [req.params.id]);
  broadcast("swaps");
  res.json({ ok: true });
});

export default router;
