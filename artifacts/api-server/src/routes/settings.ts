import { Router } from "express";
import { getSettings, updateSettings } from "../lib/store";
import { findMemberById } from "../lib/store";

const router = Router();

router.get("/settings", async (req, res) => {
  const settings = await getSettings();
  res.json({ settings });
});

router.put("/settings", async (req, res) => {
  const requesterId = req.headers["x-member-id"] as string | undefined;
  if (!requesterId) { res.status(403).json({ error: "Sem permissão" }); return; }
  const requester = await findMemberById(requesterId);
  if (!requester || !requester.isAdmin) { res.status(403).json({ error: "Sem permissão" }); return; }

  const { nightStart, nightEnd } = req.body ?? {};

  const timeRe = /^\d{2}:\d{2}$/;
  if (nightStart !== undefined && !timeRe.test(nightStart)) {
    res.status(400).json({ error: "Formato de hora inválido (HH:MM)" }); return;
  }
  if (nightEnd !== undefined && !timeRe.test(nightEnd)) {
    res.status(400).json({ error: "Formato de hora inválido (HH:MM)" }); return;
  }

  const updated = await updateSettings({ nightStart, nightEnd });
  res.json({ settings: updated });
});

export default router;
