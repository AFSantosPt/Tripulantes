import type { Response } from "express";

export type SseEvent = "shifts" | "breakdowns" | "swaps" | "members";

const clients = new Set<Response>();

export function addSseClient(res: Response): void {
  clients.add(res);
  res.on("close", () => clients.delete(res));
}

export function broadcast(event: SseEvent): void {
  const payload = `event: ${event}\ndata: {}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}
