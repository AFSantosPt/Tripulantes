import { Router } from "express";
import pool from "../lib/db";
import { newId } from "../lib/id";
import { broadcast } from "../lib/sse";
import { findMemberById } from "../lib/store";

const ABSENCE_TYPES = new Set(["folga", "ferias"]);

interface ShiftStop { location: string; time: string; }

interface Shift {
  id: string; crewMemberId: string; date: string; code?: string; vehicleCode?: string;
  affectation: string; affectationLabel?: string; stops: ShiftStop[];
  notes?: string; availableForSwap?: boolean; createdAt: string;
}

function rowToShift(row: any): Shift {
  return {
    id: row.id, crewMemberId: row.crew_member_id, date: row.date,
    code: row.code ?? undefined, vehicleCode: row.vehicle_code ?? undefined,
    affectation: row.affectation, affectationLabel: row.affectation_label ?? undefined,
    stops: row.stops ?? [], notes: row.notes ?? undefined,
    availableForSwap: row.available_for_swap ?? false,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

async function requireActiveMember(memberId: string | undefined) {
  if (!memberId) return null;
  const m = await findMemberById(memberId);
  return m?.status === "active" ? m : null;
}

const router = Router();

router.get("/shifts", async (req, res) => {
  const member = await requireActiveMember(req.headers["x-member-id"] as string);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const r = await pool.query("SELECT * FROM shifts WHERE crew_member_id=$1 ORDER BY date DESC", [member.id]);
  res.json({ shifts: r.rows.map(rowToShift) });
});

router.get("/shifts/all", async (req, res) => {
  const member = await requireActiveMember(req.headers["x-member-id"] as string);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const r = await pool.query("SELECT * FROM shifts ORDER BY date DESC");
  res.json({ shifts: r.rows.map(rowToShift) });
});

router.post("/shifts", async (req, res) => {
  const member = await requireActiveMember(req.headers["x-member-id"] as string);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const body = req.body as Omit<Shift, "id" | "crewMemberId" | "createdAt">;
  if (!body.date || !body.affectation || !Array.isArray(body.stops)) {
    res.status(400).json({ error: "Dados em falta" }); return;
  }
  const startTime = body.stops[0]?.time ?? "";
  const endTime = body.stops[body.stops.length - 1]?.time ?? "";
  let dup;
  if (ABSENCE_TYPES.has(body.affectation)) {
    dup = await pool.query(
      "SELECT id FROM shifts WHERE crew_member_id=$1 AND date=$2 AND affectation=$3",
      [member.id, body.date, body.affectation],
    );
  } else {
    dup = await pool.query(
      "SELECT id FROM shifts WHERE crew_member_id=$1 AND date=$2 AND NOT affectation=ANY($3) AND stops->0->>'time'=$4 AND stops->-1->>'time'=$5",
      [member.id, body.date, Array.from(ABSENCE_TYPES), startTime, endTime],
    );
  }
  if (dup.rows.length > 0) {
    res.status(409).json({ error: "Já existe um serviço neste dia com as mesmas horas de início e fim." }); return;
  }
  const id = newId();
  const r = await pool.query(
    `INSERT INTO shifts (id,crew_member_id,date,code,vehicle_code,affectation,affectation_label,stops,notes,available_for_swap,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()) RETURNING *`,
    [id, member.id, body.date, body.code ?? null, body.vehicleCode ?? null, body.affectation,
     body.affectationLabel ?? null, JSON.stringify(body.stops), body.notes ?? null, body.availableForSwap ?? false],
  );
  broadcast("shifts");
  res.status(201).json({ shift: rowToShift(r.rows[0]) });
});

router.put("/shifts/:id", async (req, res) => {
  const member = await requireActiveMember(req.headers["x-member-id"] as string);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const existing = await pool.query("SELECT * FROM shifts WHERE id=$1", [req.params.id]);
  if (!existing.rows[0]) { res.status(404).json({ error: "Serviço não encontrado" }); return; }
  if (existing.rows[0].crew_member_id !== member.id) { res.status(403).json({ error: "Sem permissão" }); return; }
  const body = req.body as Omit<Shift, "id" | "crewMemberId" | "createdAt">;
  const startTime = body.stops[0]?.time ?? "";
  const endTime = body.stops[body.stops.length - 1]?.time ?? "";
  let dup;
  if (ABSENCE_TYPES.has(body.affectation)) {
    dup = await pool.query(
      "SELECT id FROM shifts WHERE crew_member_id=$1 AND date=$2 AND affectation=$3 AND id!=$4",
      [member.id, body.date, body.affectation, req.params.id],
    );
  } else {
    dup = await pool.query(
      "SELECT id FROM shifts WHERE crew_member_id=$1 AND date=$2 AND NOT affectation=ANY($3) AND stops->0->>'time'=$4 AND stops->-1->>'time'=$5 AND id!=$6",
      [member.id, body.date, Array.from(ABSENCE_TYPES), startTime, endTime, req.params.id],
    );
  }
  if (dup.rows.length > 0) {
    res.status(409).json({ error: "Já existe outro serviço neste dia com as mesmas horas de início e fim." }); return;
  }
  const r = await pool.query(
    `UPDATE shifts SET date=$1,code=$2,vehicle_code=$3,affectation=$4,affectation_label=$5,stops=$6,notes=$7,available_for_swap=$8 WHERE id=$9 RETURNING *`,
    [body.date, body.code ?? null, body.vehicleCode ?? null, body.affectation, body.affectationLabel ?? null,
     JSON.stringify(body.stops), body.notes ?? null, body.availableForSwap ?? false, req.params.id],
  );
  broadcast("shifts");
  res.json({ shift: rowToShift(r.rows[0]) });
});

router.delete("/shifts/:id", async (req, res) => {
  const member = await requireActiveMember(req.headers["x-member-id"] as string);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const existing = await pool.query("SELECT * FROM shifts WHERE id=$1", [req.params.id]);
  if (!existing.rows[0]) { res.status(404).json({ error: "Serviço não encontrado" }); return; }
  if (existing.rows[0].crew_member_id !== member.id && !member.isAdmin) { res.status(403).json({ error: "Sem permissão" }); return; }
  await pool.query("DELETE FROM shifts WHERE id=$1", [req.params.id]);
  broadcast("shifts");
  res.json({ ok: true });
});

router.patch("/shifts/:id/swap-available", async (req, res) => {
  const member = await requireActiveMember(req.headers["x-member-id"] as string);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const existing = await pool.query("SELECT * FROM shifts WHERE id=$1", [req.params.id]);
  if (!existing.rows[0]) { res.status(404).json({ error: "Serviço não encontrado" }); return; }
  if (existing.rows[0].crew_member_id !== member.id) { res.status(403).json({ error: "Sem permissão" }); return; }
  const available = Boolean(req.body?.available);
  const r = await pool.query("UPDATE shifts SET available_for_swap=$1 WHERE id=$2 RETURNING *", [available, req.params.id]);
  broadcast("shifts");
  res.json({ shift: rowToShift(r.rows[0]) });
});

router.post("/shifts/swap-available/bulk", async (req, res) => {
  const member = await requireActiveMember(req.headers["x-member-id"] as string);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  const { ids, available } = req.body ?? {};
  if (!Array.isArray(ids)) { res.status(400).json({ error: "ids obrigatório" }); return; }
  if (ids.length > 0) {
    await pool.query(
      "UPDATE shifts SET available_for_swap=$1 WHERE id=ANY($2) AND crew_member_id=$3",
      [Boolean(available), ids, member.id],
    );
    broadcast("shifts");
  }
  res.json({ ok: true });
});

export default router;
