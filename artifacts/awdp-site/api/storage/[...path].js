import { createAwdpApiHandler } from "../../vercel-serverless-bridge.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default createAwdpApiHandler("storage");
