import { hashPassword } from "./hash";
import { newId } from "./id";
import pool from "./db";

const DEFAULT_ADMIN = {
  name: "André Santos",
  crewId: "180939",
  password: "andres91",
};

export type AccountStatus = "pending" | "active" | "inactive";
export type CrewCategory = "guarda-freio" | "motorista" | "outro";

export interface CrewMember {
  id: string;
  name: string;
  nickname?: string;
  phone?: string;
  crewId: string;
  passwordHash: string;
  status: AccountStatus;
  isAdmin: boolean;
  categories: CrewCategory[];
  categoryOtherLabel?: string;
  folgaGroup?: string;
  createdAt: string;
  approvedAt?: string;
  approvedById?: string;
  lastSeenAt?: string;
}

function rowToMember(row: any): CrewMember {
  return {
    id: row.id,
    name: row.name,
    nickname: row.nickname ?? undefined,
    phone: row.phone ?? undefined,
    lastSeenAt: row.last_seen_at ? (row.last_seen_at instanceof Date ? row.last_seen_at.toISOString() : String(row.last_seen_at)) : undefined,
    crewId: row.crew_id,
    passwordHash: row.password_hash,
    status: row.status as AccountStatus,
    isAdmin: row.is_admin,
    categories: row.categories ?? [],
    categoryOtherLabel: row.category_other_label ?? undefined,
    folgaGroup: row.folga_group ?? undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    approvedAt: row.approved_at ? (row.approved_at instanceof Date ? row.approved_at.toISOString() : String(row.approved_at)) : undefined,
    approvedById: row.approved_by_id ?? undefined,
  };
}

export async function readMembers(): Promise<CrewMember[]> {
  const res = await pool.query("SELECT * FROM members ORDER BY created_at");
  return res.rows.map(rowToMember);
}

export async function findMemberByCrewId(crewId: string): Promise<CrewMember | undefined> {
  const res = await pool.query("SELECT * FROM members WHERE crew_id = $1", [crewId]);
  return res.rows[0] ? rowToMember(res.rows[0]) : undefined;
}

export async function findMemberById(id: string): Promise<CrewMember | undefined> {
  const res = await pool.query("SELECT * FROM members WHERE id = $1", [id]);
  return res.rows[0] ? rowToMember(res.rows[0]) : undefined;
}

export async function createMember(m: Omit<CrewMember, "id" | "createdAt">): Promise<CrewMember> {
  const id = newId();
  const res = await pool.query(
    `INSERT INTO members (id, name, crew_id, password_hash, status, is_admin, categories, category_other_label, created_at, approved_at, approved_by_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),$9,$10) RETURNING *`,
    [id, m.name, m.crewId, m.passwordHash, m.status, m.isAdmin, m.categories, m.categoryOtherLabel ?? null, m.approvedAt ?? null, m.approvedById ?? null],
  );
  return rowToMember(res.rows[0]);
}

export async function updateMember(id: string, fields: Partial<Omit<CrewMember, "id" | "createdAt">>): Promise<CrewMember | undefined> {
  const sets: string[] = [];
  const vals: any[] = [];
  let idx = 1;
  if (fields.name !== undefined)        { sets.push(`name=$${idx++}`);           vals.push(fields.name); }
  if (fields.crewId !== undefined)      { sets.push(`crew_id=$${idx++}`);        vals.push(fields.crewId); }
  if (fields.passwordHash !== undefined){ sets.push(`password_hash=$${idx++}`);  vals.push(fields.passwordHash); }
  if (fields.status !== undefined)      { sets.push(`status=$${idx++}`);         vals.push(fields.status); }
  if (fields.isAdmin !== undefined)     { sets.push(`is_admin=$${idx++}`);       vals.push(fields.isAdmin); }
  if (fields.nickname !== undefined)           { sets.push(`nickname=$${idx++}`);                vals.push(fields.nickname ?? null); }
  if (fields.phone !== undefined)              { sets.push(`phone=$${idx++}`);                   vals.push(fields.phone ?? null); }
  if (fields.categories !== undefined)         { sets.push(`categories=$${idx++}`);              vals.push(fields.categories); }
  if (fields.categoryOtherLabel !== undefined) { sets.push(`category_other_label=$${idx++}`);     vals.push(fields.categoryOtherLabel); }
  if (fields.folgaGroup !== undefined)         { sets.push(`folga_group=$${idx++}`);               vals.push(fields.folgaGroup ?? null); }
  if (fields.approvedAt !== undefined)         { sets.push(`approved_at=$${idx++}`);              vals.push(fields.approvedAt); }
  if (fields.approvedById !== undefined){ sets.push(`approved_by_id=$${idx++}`); vals.push(fields.approvedById); }
  if (!sets.length) return findMemberById(id);
  vals.push(id);
  const res = await pool.query(
    `UPDATE members SET ${sets.join(",")} WHERE id=$${idx} RETURNING *`,
    vals,
  );
  return res.rows[0] ? rowToMember(res.rows[0]) : undefined;
}

export async function deleteMember(id: string): Promise<void> {
  await pool.query("DELETE FROM members WHERE id=$1", [id]);
}

export async function seedAdminIfEmpty(): Promise<void> {
  const res = await pool.query("SELECT COUNT(*) FROM members");
  if (parseInt(res.rows[0].count, 10) === 0) {
    await createMember({
      name: DEFAULT_ADMIN.name,
      crewId: DEFAULT_ADMIN.crewId,
      passwordHash: hashPassword(DEFAULT_ADMIN.password),
      status: "active",
      isAdmin: true,
      categories: ["motorista"],
      approvedAt: new Date().toISOString(),
    });
  }
}

export function sanitize(m: CrewMember): Omit<CrewMember, "passwordHash"> {
  const { passwordHash: _ph, ...rest } = m;
  return rest;
}

export interface AppSettings {
  nightStart: string;
  nightEnd: string;
}

export async function getSettings(): Promise<AppSettings> {
  const res = await pool.query("SELECT night_start, night_end FROM app_settings WHERE id=1");
  if (!res.rows[0]) return { nightStart: "22:00", nightEnd: "06:00" };
  return { nightStart: res.rows[0].night_start, nightEnd: res.rows[0].night_end };
}

export async function updateSettings(fields: Partial<AppSettings>): Promise<AppSettings> {
  const sets: string[] = [];
  const vals: any[] = [];
  let idx = 1;
  if (fields.nightStart !== undefined) { sets.push(`night_start=$${idx++}`); vals.push(fields.nightStart); }
  if (fields.nightEnd !== undefined)   { sets.push(`night_end=$${idx++}`);   vals.push(fields.nightEnd); }
  if (!sets.length) return getSettings();
  vals.push(1);
  await pool.query(`UPDATE app_settings SET ${sets.join(",")} WHERE id=$${idx}`, vals);
  return getSettings();
}
