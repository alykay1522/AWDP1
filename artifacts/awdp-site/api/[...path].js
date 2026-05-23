/**
 * Top-level `/api/[...path]` on Vercel (non-Next.js) only matches one segment under `/api/`.
 * See `vercel-serverless-bridge.js` and nested `api/<name>/[...path].js` files.
 */
import { createAwdpApiHandler } from "../vercel-serverless-bridge.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default createAwdpApiHandler("root-one-segment");
