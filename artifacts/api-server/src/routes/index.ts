import { Router, type IRouter } from "express";
import authRouter from "./auth";
import healthRouter from "./health";
import ocrRouter from "./ocr";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ocrRouter);
router.use(authRouter);

export default router;
