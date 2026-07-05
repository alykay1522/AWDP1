import { Router, type IRouter } from "express";
import healthRouter from "./health";
import legacyProductImagesRouter from "./legacyProductImages";
import previewCatalogAuditRouter from "./previewCatalogAudit";
import productsRouter from "./products";
import partsIdRouter from "./partsId";
import contactRouter from "./contact";
import checkoutRouter from "./checkout";
import legacyPdfsRouter from "./legacyPdfs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(legacyProductImagesRouter);
router.use(previewCatalogAuditRouter);
router.use(productsRouter);
router.use(partsIdRouter);
router.use(contactRouter);
router.use(checkoutRouter);
router.use(legacyPdfsRouter);

export default router;
