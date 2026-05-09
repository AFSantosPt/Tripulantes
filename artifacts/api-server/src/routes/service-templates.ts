import { Router } from "express";
import pool from "../lib/db";
import { logger } from "../lib/logger";

const STALE_DAYS = 30;

export interface ServiceTemplate {
  id: number;
  code: string;
  startTime?: string;
  startLocation?: string;
  endTime?: string;
  endLocation?: string;
  vehicleCode?: string;
  vehicleKinds?: string[];
  affectation: string;
  usageCount: number;
  lastUsedAt: string;
}

function rowToTemplate(row: any): ServiceTemplate {
  return {
    id: row.id,
    code: row.code,
    startTime: row.start_time ?? undefined,
    startLocation: row.start_location || undefined,
    endTime: row.end_time ?? undefined,
    endLocation: row.end_location || undefined,
    vehicleCode: row.vehicle_code ?? undefined,
    vehicleKinds: row.vehicle_kinds ? JSON.parse(row.vehicle_kinds) : undefined,
    affectation: row.affectation,
    usageCount: row.usage_count,
    lastUsedAt:
      row.last_used_at instanceof Date
        ? row.last_used_at.toISOString()
        : String(row.last_used_at),
  };
}

export async function initServiceTemplatesTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS service_templates (
      id            SERIAL PRIMARY KEY,
      code          TEXT NOT NULL,
      start_location TEXT NOT NULL DEFAULT '',
      end_location  TEXT NOT NULL DEFAULT '',
      start_time    TEXT,
      end_time      TEXT,
      vehicle_code  TEXT,
      vehicle_kinds TEXT,
      affectation   TEXT NOT NULL DEFAULT 'normal',
      usage_count   INTEGER NOT NULL DEFAULT 1,
      last_used_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (code, start_location, end_location)
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_svc_tmpl_code ON service_templates (code)`,
  );
}

export async function upsertServiceTemplate(data: {
  code: string;
  startTime?: string;
  startLocation?: string;
  endTime?: string;
  endLocation?: string;
  vehicleCode?: string;
  vehicleKinds?: string[];
  affectation: string;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO service_templates
         (code, start_location, end_location, start_time, end_time, vehicle_code, vehicle_kinds, affectation, usage_count, last_used_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, NOW())
       ON CONFLICT (code, start_location, end_location)
       DO UPDATE SET
         start_time    = EXCLUDED.start_time,
         end_time      = EXCLUDED.end_time,
         vehicle_code  = COALESCE(EXCLUDED.vehicle_code, service_templates.vehicle_code),
         vehicle_kinds = COALESCE(EXCLUDED.vehicle_kinds, service_templates.vehicle_kinds),
         affectation   = EXCLUDED.affectation,
         usage_count   = service_templates.usage_count + 1,
         last_used_at  = NOW()`,
      [
        data.code,
        data.startLocation ?? "",
        data.endLocation ?? "",
        data.startTime ?? null,
        data.endTime ?? null,
        data.vehicleCode ?? null,
        data.vehicleKinds && data.vehicleKinds.length > 0
          ? JSON.stringify(data.vehicleKinds)
          : null,
        data.affectation,
      ],
    );
  } catch (err) {
    logger.warn({ err }, "Failed to upsert service template");
  }
}

const router = Router();

router.get("/service-templates", async (req, res): Promise<void> => {
  pool
    .query(
      `DELETE FROM service_templates WHERE last_used_at < NOW() - INTERVAL '${STALE_DAYS} days'`,
    )
    .catch(() => {});

  const q = ((req.query["q"] as string) ?? "").trim();
  const rows = q
    ? await pool.query(
        `SELECT * FROM service_templates WHERE code ILIKE $1 ORDER BY usage_count DESC, last_used_at DESC LIMIT 12`,
        [q + "%"],
      )
    : await pool.query(
        `SELECT * FROM service_templates ORDER BY usage_count DESC, last_used_at DESC LIMIT 12`,
      );

  res.json({ templates: rows.rows.map(rowToTemplate) });
});

export default router;
