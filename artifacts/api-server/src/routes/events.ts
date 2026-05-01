import { Router } from "express";
import { addSseClient } from "../lib/sse";
import { readMembers } from "../lib/store";

const router = Router();

router.get("/events", async (req, res) => {
  const memberId = (req.query.mid as string | undefined) || (req.headers["x-member-id"] as string | undefined);
  if (!memberId) { res.status(403).json({ error: "Sem permissão" }); return; }
  const members = await readMembers();
  const member = members.find((m) => m.id === memberId && m.status === "active");
  if (!member) { res.status(403).json({ error: "Sem permissão" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write("event: connected\ndata: {}\n\n");

  addSseClient(res);

  const keepAlive = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { clearInterval(keepAlive); }
  }, 20000);

  req.on("close", () => clearInterval(keepAlive));
});

export default router;
