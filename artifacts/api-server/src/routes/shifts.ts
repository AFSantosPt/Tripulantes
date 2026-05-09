import { Router } from "express";
import pool from "../lib/db";
import { newId } from "../lib/id";
import { broadcast } from "../lib/sse";
import { findMemberById } from "../lib/store";
import { upsertServiceTemplate } from "./service-templates";

const ABSENCE_TYPES = new Set(["folga", "ferias"]);

interface ShiftStop { location: string; time: string; }

function parseVehicleKinds(raw: any): string[] | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed.length > 0 ? parsed : undefined;
    return [String(parsed)];
  } catch {
    return [s];
  }
}

interface Shift {
  id: string; crewMemberId: string; date: string; code?: string; vehicleCode?: string;
  vehicleKinds?: string[]; fleetNumber?: string;
  affectation: string; affectationLabel?: string; stops: ShiftStop[];
  notes?: string; availableForSwap?: boolean; createdAt: string;
}

function rowToShift(row: any): Shift {
  return {
    id: row.id, crewMemberId: row.crew_member_id, date: row.date,
    code: row.code ?? undefined, vehicleCode: row.vehicle_code ?? undefined,
    vehicleKinds: parseVehicleKinds(row.vehicle_kind), fleetNumber: row.fleet_number ?? undefined,
    affectation: row.affectation, affectationLabel: row.affectation_label ?? undefined,
    stops: row.stops ?? [], notes: row.notes ?? undefined,
    availableForSwap: row.available_for_swap ?? false,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

function parseMinutes(time: string): number | null {
  const m = /^(\d{1,3}):([0-5]?\d)$/.exec(time);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

async function checkOverlap(
  memberId: string,
  date: string,
  stops: ShiftStop[],
  excludeId?: string,
): Promise<string | null> {
  if (stops.length < 2) return null;
  const newStart = parseMinutes(stops[0].time);
  const newEnd = parseMinutes(stops[stops.length - 1].time);
  if (newStart == null || newEnd == null || newEnd <= newStart) return null;

  const params: any[] = [memberId, date, Array.from(ABSENCE_TYPES)];
  let sql = `SELECT stops FROM shifts
    WHERE crew_member_id=$1 AND date=$2 AND NOT affectation=ANY($3)`;
  if (excludeId) { params.push(excludeId); sql += ` AND id!=$${params.length}`; }

  const r = await pool.query(sql, params);
  for (const row of r.rows) {
    const s: ShiftStop[] = row.stops ?? [];
    if (s.length < 2) continue;
    const exStart = parseMinutes(s[0].time);
    const exEnd = parseMinutes(s[s.length - 1].time);
    if (exStart == null || exEnd == null) continue;
    if (newStart < exEnd && exStart < newEnd) {
      return `Sobreposição com serviço existente das ${s[0].time} às ${s[s.length - 1].time}`;
    }
  }
  return null;
}

function isoAddDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function checkRestPeriod(
  memberId: string,
  date: string,
  stops: ShiftStop[],
  excludeId?: string,
): Promise<string | null> {
  if (stops.length < 2) return null;
  const newStart = parseMinutes(stops[0].time);
  const newEnd = parseMinutes(stops[stops.length - 1].time);
  if (newStart == null || newEnd == null) return null;

  const REST_MIN = 660;
  const prevDate = isoAddDays(date, -1);
  const nextDate = isoAddDays(date, 1);

  const params: any[] = [memberId, [prevDate, nextDate], Array.from(ABSENCE_TYPES)];
  let sql = `SELECT date, stops FROM shifts
    WHERE crew_member_id=$1 AND date=ANY($2) AND NOT affectation=ANY($3)`;
  if (excludeId) { params.push(excludeId); sql += ` AND id!=$${params.length}`; }

  const r = await pool.query(sql, params);
  for (const row of r.rows) {
    const s: ShiftStop[] = row.stops ?? [];
    if (s.length < 2) continue;
    const adjStart = parseMinutes(s[0].time);
    const adjEnd = parseMinutes(s[s.length - 1].time);
    if (adjStart == null || adjEnd == null) continue;

    if (row.date === prevDate) {
      const gap = 1440 + newStart - adjEnd;
      if (gap < REST_MIN) {
        const h = Math.floor(gap / 60);
        const m = gap % 60;
        return `Descanso insuficiente antes deste serviço: ${h}h${m ? String(m).padStart(2, "0") + "min" : ""} (mínimo 11h obrigatórias)`;
      }
    } else if (row.date === nextDate) {
      const gap = 1440 + adjStart - newEnd;
      if (gap < REST_MIN) {
        const h = Math.floor(gap / 60);
        const m = gap % 60;
        return `Descanso insuficiente após este serviço: ${h}h${m ? String(m).padStart(2, "0") + "min" : ""} (mínimo 11h obrigatórias)`;
      }
    }
  }
  return null;
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
  if (!ABSENCE_TYPES.has(body.affectation)) {
    const overlap = await checkOverlap(member.id, body.date, body.stops);
    if (overlap) { res.status(409).json({ error: overlap }); return; }
    const rest = await checkRestPeriod(member.id, body.date, body.stops);
    if (rest) { res.status(409).json({ error: rest }); return; }
  }
  const id = newId();
  const r = await pool.query(
    `INSERT INTO shifts (id,crew_member_id,date,code,vehicle_code,vehicle_kind,fleet_number,affectation,affectation_label,stops,notes,available_for_swap,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW()) RETURNING *`,
    [id, member.id, body.date, body.code ?? null, body.vehicleCode ?? null,
     Array.isArray(body.vehicleKinds) && body.vehicleKinds.length > 0 ? JSON.stringify(body.vehicleKinds) : null,
     body.fleetNumber ?? null,
     body.affectation, body.affectationLabel ?? null, JSON.stringify(body.stops), body.notes ?? null, body.availableForSwap ?? false],
  );
  if (body.code && !ABSENCE_TYPES.has(body.affectation)) {
    upsertServiceTemplate({
      code: body.code,
      startTime: body.stops[0]?.time,
      startLocation: body.stops[0]?.location,
      endTime: body.stops[body.stops.length - 1]?.time,
      endLocation: body.stops[body.stops.length - 1]?.location,
      vehicleCode: body.vehicleCode,
      vehicleKinds: body.vehicleKinds,
      affectation: body.affectation,
    }).catch(() => {});
  }
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
  if (!ABSENCE_TYPES.has(body.affectation)) {
    const overlap = await checkOverlap(member.id, body.date, body.stops, req.params.id);
    if (overlap) { res.status(409).json({ error: overlap }); return; }
    const rest = await checkRestPeriod(member.id, body.date, body.stops, req.params.id);
    if (rest) { res.status(409).json({ error: rest }); return; }
  }
  const r = await pool.query(
    `UPDATE shifts SET date=$1,code=$2,vehicle_code=$3,vehicle_kind=$4,fleet_number=$5,affectation=$6,affectation_label=$7,stops=$8,notes=$9,available_for_swap=$10,updated_at=NOW() WHERE id=$11 RETURNING *`,
    [body.date, body.code ?? null, body.vehicleCode ?? null,
     Array.isArray(body.vehicleKinds) && body.vehicleKinds.length > 0 ? JSON.stringify(body.vehicleKinds) : null,
     body.fleetNumber ?? null,
     body.affectation, body.affectationLabel ?? null, JSON.stringify(body.stops),
     body.notes ?? null, body.availableForSwap ?? false, req.params.id],
  );
  if (body.code && !ABSENCE_TYPES.has(body.affectation)) {
    upsertServiceTemplate({
      code: body.code,
      startTime: body.stops[0]?.time,
      startLocation: body.stops[0]?.location,
      endTime: body.stops[body.stops.length - 1]?.time,
      endLocation: body.stops[body.stops.length - 1]?.location,
      vehicleCode: body.vehicleCode,
      vehicleKinds: body.vehicleKinds,
      affectation: body.affectation,
    }).catch(() => {});
  }
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
