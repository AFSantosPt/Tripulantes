import { Router, type IRouter } from "express";
import authRouter from "./auth";
import breakdownsRouter from "./breakdowns";
import healthRouter from "./health";
import ocrRouter from "./ocr";
import swapsRouter from "./swaps";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ocrRouter);
router.use(authRouter);
router.use(breakdownsRouter);
router.use(swapsRouter);

export default router;
