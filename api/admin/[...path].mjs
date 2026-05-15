import { createAwdpApiHandler } from "../../artifacts/awdp-site/vercel-serverless-bridge.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default createAwdpApiHandler("admin");
