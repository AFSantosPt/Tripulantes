import { Router } from "express";
import pool from "../lib/db";
import { newId } from "../lib/id";
import { broadcast } from "../lib/sse";
import { findMemberById } from "../lib/store";

function rowToNotice(row: any, readByIds: string[]) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    authorId: row.author_id,
    authorName: row.author_name,
    targetMemberId: row.target_member_id ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    readByIds,
  };
}

async function requireActiveMember(memberId: string | undefined) {
  if (!memberId) return null;
  const m = await findMemberById(memberId);
  return m?.status === "active" ? m : null;
}

const router = Router();

router.get("/notices", async (req, res) => {
  const member = await requireActiveMember(req.headers["x-member-id"] as string);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }

  const noticesRes = await pool.query(
    `SELECT * FROM notices
     WHERE target_member_id IS NULL OR target_member_id = $1
     ORDER BY created_at DESC`,
    [member.id],
  );

  if (noticesRes.rows.length === 0) {
    res.json({ notices: [] });
    return;
  }

  const noticeIds = noticesRes.rows.map((r: any) => r.id);
  const readsRes = await pool.query(
    `SELECT notice_id, member_id FROM notice_reads WHERE notice_id = ANY($1)`,
    [noticeIds],
  );

  const readMap = new Map<string, string[]>();
  for (const r of readsRes.rows) {
    if (!readMap.has(r.notice_id)) readMap.set(r.notice_id, []);
    readMap.get(r.notice_id)!.push(r.member_id);
  }

  res.json({
    notices: noticesRes.rows.map((r: any) => rowToNotice(r, readMap.get(r.id) ?? [])),
  });
});

router.post("/notices", async (req, res) => {
  const member = await requireActiveMember(req.headers["x-member-id"] as string);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  if (!member.isAdmin) { res.status(403).json({ error: "Apenas administradores" }); return; }

  const { title, body, targetMemberId } = req.body as {
    title?: string;
    body?: string;
    targetMemberId?: string | null;
  };

  if (!title?.trim() || !body?.trim()) {
    res.status(400).json({ error: "Título e texto são obrigatórios" });
    return;
  }

  if (targetMemberId) {
    const target = await findMemberById(targetMemberId);
    if (!target || target.status !== "active") {
      res.status(400).json({ error: "Membro de destino inválido" });
      return;
    }
  }

  const id = newId();
  const r = await pool.query(
    `INSERT INTO notices (id, title, body, author_id, author_name, target_member_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [id, title.trim(), body.trim(), member.id, member.name, targetMemberId ?? null],
  );

  broadcast("notices");
  res.status(201).json({ notice: rowToNotice(r.rows[0], []) });
});

router.post("/notices/:id/read", async (req, res) => {
  const member = await requireActiveMember(req.headers["x-member-id"] as string);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }

  await pool.query(
    `INSERT INTO notice_reads (notice_id, member_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [req.params.id, member.id],
  );
  res.json({ ok: true });
});

router.delete("/notices/:id", async (req, res) => {
  const member = await requireActiveMember(req.headers["x-member-id"] as string);
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }
  if (!member.isAdmin) { res.status(403).json({ error: "Apenas administradores" }); return; }

  const existing = await pool.query("SELECT id FROM notices WHERE id=$1", [req.params.id]);
  if (!existing.rows.length) { res.status(404).json({ error: "Aviso não encontrado" }); return; }

  await pool.query("DELETE FROM notices WHERE id=$1", [req.params.id]);
  broadcast("notices");
  res.json({ ok: true });
});

export default router;
