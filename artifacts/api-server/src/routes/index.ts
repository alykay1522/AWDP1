import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import partsIdRouter from "./partsId";
import checkoutRouter from "./checkout";
import legacyPdfsRouter from "./legacyPdfs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(partsIdRouter);
router.use(checkoutRouter);
router.use(legacyPdfsRouter);

export default router;
