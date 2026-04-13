import { Router, type IRouter } from "express";
import healthRouter from "./health";
import watchlistRouter from "./watchlist";
import stocksRouter from "./stocks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(watchlistRouter);
router.use(stocksRouter);

export default router;
