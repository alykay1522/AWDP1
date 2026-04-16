import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import partsIdRouter from "./partsId";
import checkoutRouter from "./checkout";
import adminProductsRouter from "./adminProducts";
import adminOrdersRouter from "./adminOrders";
import adminImagesRouter from "./adminImages";
import adminSettingsRouter from "./adminSettings";
import adminGenerateRouter from "./adminGenerate";
import priceMonitorRouter from "./priceMonitor";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(partsIdRouter);
router.use(checkoutRouter);

// Admin routes
router.use(adminProductsRouter);
router.use(adminOrdersRouter);
router.use(adminImagesRouter);
router.use(adminSettingsRouter);
router.use(adminGenerateRouter);
router.use(priceMonitorRouter);

export default router;
