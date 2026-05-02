import { Router, type IRouter } from "express";
import authRouter from "./auth";
import breakdownsRouter from "./breakdowns";
import eventsRouter from "./events";
import healthRouter from "./health";
import noticesRouter from "./notices";
import ocrRouter from "./ocr";
import settingsRouter from "./settings";
import shiftsRouter from "./shifts";
import swapsRouter from "./swaps";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ocrRouter);
router.use(authRouter);
router.use(eventsRouter);
router.use(breakdownsRouter);
router.use(swapsRouter);
router.use(shiftsRouter);
router.use(noticesRouter);
router.use(settingsRouter);

export default router;
