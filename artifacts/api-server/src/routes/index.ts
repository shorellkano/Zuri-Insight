import { Router, type IRouter } from "express";
import healthRouter from "./health";
import brandsRouter from "./brands";
import generateRouter from "./generate";
import quickCreateRouter from "./quick-create";
import contentRouter from "./content";
import dashboardRouter from "./dashboard";
import voiceLessonsRouter from "./voice-lessons";
import creativeStudioRouter from "./creative-studio";
import calendarRouter from "./calendar";
import bulkPlanRouter from "./bulk-plan";
import brandCalendarRouter from "./brand-calendar";

const router: IRouter = Router();

router.use(healthRouter);
router.use(brandsRouter);
router.use(generateRouter);
router.use(quickCreateRouter);
router.use(contentRouter);
router.use(dashboardRouter);
router.use(voiceLessonsRouter);
router.use(creativeStudioRouter);
router.use(calendarRouter);
router.use(bulkPlanRouter);
router.use(brandCalendarRouter);

export default router;
