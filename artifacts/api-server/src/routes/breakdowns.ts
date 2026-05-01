import { Router } from "express";
import pool from "../lib/db";
import { newId } from "../lib/id";
import { broadcast } from "../lib/sse";
import { findMemberById } from "../lib/store";

const REQUIRED_CONFIRMATIONS = 2;
const MAX_PHOTOS = 3;
const PHOTO_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

export const REQUIRED_CONFIRMATIONS_COUNT = REQUIRED_CONFIRMATIONS;

interface Confirmation { crewMemberId: string; crewMemberName: string; crewIdLabel: string; at: string; }
interface BreakdownPhoto { id: string; uri: string; addedAt: string; addedById: string; addedByName: string; }
interface Breakdown {
  id: string; vehicleKind: string; fleetNumber: string; description: string;
  reportedById: string; reportedByName: string; reportedByCrewId: string;
  reportedAt: string; confirmations: Confirmation[]; photos: BreakdownPhoto[];
}

function rowToBreakdown(row: any): Breakdown {
  const now = Date.now();
  const photos: BreakdownPhoto[] = (row.photos ?? []).filter(
    (p: BreakdownPhoto) => now - new Date(p.addedAt).getTime() < PHOTO_LIFETIME_MS,
  );
  return {
    id: row.id, vehicleKind: row.vehicle_kind, fleetNumber: row.fleet_number,
    description: row.description, reportedById: row.reported_by_id,
    reportedByName: row.reported_by_name, reportedByCrewId: row.reported_by_crew_id,
    reportedAt: row.reported_at instanceof Date ? row.reported_at.toISOString() : String(row.reported_at),
    confirmations: row.confirmations ?? [], photos,
  };
}

async function requireActiveMember(memberId: string | undefined) {
  if (!memberId) return null;
  const m = await findMemberById(memberId);
  return m?.status === "active" ? m : null;
}

const router = Router();

router.get("/breakdowns", async (req, res) => {
  const member = await requireActiveMember(req.headers["x-member-id"] as string);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const r = await pool.query("SELECT * FROM breakdowns ORDER BY reported_at DESC");
  res.json({ breakdowns: r.rows.map(rowToBreakdown) });
});

router.post("/breakdowns", async (req, res) => {
  const member = await requireActiveMember(req.headers["x-member-id"] as string);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const { vehicleKind, fleetNumber, description } = req.body ?? {};
  if (!vehicleKind || !fleetNumber?.trim() || !description?.trim()) {
    res.status(400).json({ error: "Campos obrigatórios em falta" }); return;
  }
  const id = newId();
  const r = await pool.query(
    `INSERT INTO breakdowns (id,vehicle_kind,fleet_number,description,reported_by_id,reported_by_name,reported_by_crew_id,reported_at,confirmations,photos)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),'[]','[]') RETURNING *`,
    [id, vehicleKind, String(fleetNumber).trim(), String(description).trim(), member.id, member.name, member.crewId],
  );
  broadcast("breakdowns");
  res.status(201).json({ breakdown: rowToBreakdown(r.rows[0]) });
});

router.post("/breakdowns/:id/confirm", async (req, res) => {
  const member = await requireActiveMember(req.headers["x-member-id"] as string);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const existing = await pool.query("SELECT * FROM breakdowns WHERE id=$1", [req.params.id]);
  if (!existing.rows[0]) { res.status(404).json({ error: "Avaria não encontrada" }); return; }
  const b = rowToBreakdown(existing.rows[0]);
  if (b.reportedById === member.id) { res.status(400).json({ error: "Quem reportou não pode validar a sua própria avaria" }); return; }
  if (b.confirmations.some((c) => c.crewMemberId === member.id)) { res.status(400).json({ error: "Já validaste esta avaria" }); return; }
  if (b.confirmations.length >= REQUIRED_CONFIRMATIONS) { res.status(400).json({ error: "Avaria já resolvida" }); return; }
  const newConf: Confirmation = { crewMemberId: member.id, crewMemberName: member.name, crewIdLabel: member.crewId, at: new Date().toISOString() };
  const updated = [...b.confirmations, newConf];
  const r = await pool.query("UPDATE breakdowns SET confirmations=$1 WHERE id=$2 RETURNING *", [JSON.stringify(updated), req.params.id]);
  broadcast("breakdowns");
  res.json({ breakdown: rowToBreakdown(r.rows[0]) });
});

router.patch("/breakdowns/:id", async (req, res) => {
  const member = await requireActiveMember(req.headers["x-member-id"] as string);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const existing = await pool.query("SELECT * FROM breakdowns WHERE id=$1", [req.params.id]);
  if (!existing.rows[0]) { res.status(404).json({ error: "Avaria não encontrada" }); return; }
  if (existing.rows[0].reported_by_id !== member.id && !member.isAdmin) {
    res.status(403).json({ error: "Só o autor ou o administrador pode editar esta avaria" }); return;
  }
  const { vehicleKind, fleetNumber, description } = req.body ?? {};
  if (!vehicleKind || !fleetNumber?.trim() || !description?.trim()) {
    res.status(400).json({ error: "Campos obrigatórios em falta" }); return;
  }
  const r = await pool.query(
    "UPDATE breakdowns SET vehicle_kind=$1, fleet_number=$2, description=$3 WHERE id=$4 RETURNING *",
    [vehicleKind, String(fleetNumber).trim(), String(description).trim(), req.params.id],
  );
  broadcast("breakdowns");
  res.json({ breakdown: rowToBreakdown(r.rows[0]) });
});

router.delete("/breakdowns/:id", async (req, res) => {
  const member = await requireActiveMember(req.headers["x-member-id"] as string);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const existing = await pool.query("SELECT * FROM breakdowns WHERE id=$1", [req.params.id]);
  if (!existing.rows[0]) { res.status(404).json({ error: "Avaria não encontrada" }); return; }
  if (existing.rows[0].reported_by_id !== member.id && !member.isAdmin) { res.status(403).json({ error: "Sem permissão" }); return; }
  await pool.query("DELETE FROM breakdowns WHERE id=$1", [req.params.id]);
  broadcast("breakdowns");
  res.json({ ok: true });
});

router.post("/breakdowns/:id/photos", async (req, res) => {
  const member = await requireActiveMember(req.headers["x-member-id"] as string);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const { uri } = req.body ?? {};
  if (!uri) { res.status(400).json({ error: "URI obrigatória" }); return; }
  const existing = await pool.query("SELECT * FROM breakdowns WHERE id=$1", [req.params.id]);
  if (!existing.rows[0]) { res.status(404).json({ error: "Avaria não encontrada" }); return; }
  const b = rowToBreakdown(existing.rows[0]);
  if (b.photos.length >= MAX_PHOTOS) { res.status(400).json({ error: `Máximo de ${MAX_PHOTOS} fotografias por avaria` }); return; }
  const photo: BreakdownPhoto = { id: newId(), uri, addedAt: new Date().toISOString(), addedById: member.id, addedByName: member.name };
  const updated = [photo, ...b.photos];
  const r = await pool.query("UPDATE breakdowns SET photos=$1 WHERE id=$2 RETURNING *", [JSON.stringify(updated), req.params.id]);
  broadcast("breakdowns");
  res.json({ breakdown: rowToBreakdown(r.rows[0]) });
});

router.delete("/breakdowns/:id/photos/:photoId", async (req, res) => {
  const member = await requireActiveMember(req.headers["x-member-id"] as string);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const existing = await pool.query("SELECT * FROM breakdowns WHERE id=$1", [req.params.id]);
  if (!existing.rows[0]) { res.status(404).json({ error: "Avaria não encontrada" }); return; }
  const b = rowToBreakdown(existing.rows[0]);
  const updated = b.photos.filter((p) => p.id !== req.params.photoId);
  const r = await pool.query("UPDATE breakdowns SET photos=$1 WHERE id=$2 RETURNING *", [JSON.stringify(updated), req.params.id]);
  broadcast("breakdowns");
  res.json({ breakdown: rowToBreakdown(r.rows[0]) });
});

export default router;
