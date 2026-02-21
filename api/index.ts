import { createApp } from "../src/app.ts";

export default async function handler(req: any, res: any) {
  const app = await createApp();
  return app(req, res);
}
