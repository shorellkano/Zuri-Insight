import { Router, type IRouter } from "express";
import healthRouter from "./health";
import brandsRouter from "./brands";
import generateRouter from "./generate";
import contentRouter from "./content";
import dashboardRouter from "./dashboard";
import voiceLessonsRouter from "./voice-lessons";

const router: IRouter = Router();

router.use(healthRouter);
router.use(brandsRouter);
router.use(generateRouter);
router.use(contentRouter);
router.use(dashboardRouter);
router.use(voiceLessonsRouter);

export default router;
