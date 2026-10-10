// Test-only transport fixture. Not an application endpoint or business schema.
import express from "express";
import { contractVersion } from "@dental-lab/contracts";
import { z } from "zod";
export function createProbe() {
  const app = express();
  const schema = z.strictObject({ version: z.literal(contractVersion) });
  app.use(express.json({ limit: "1kb" }));
  app.post("/test-contract", (req, res) => {
    const input = schema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ code: "INVALID_TEST_CONTRACT" });
      return;
    }
    res.json({ version: contractVersion });
  });
  return app;
}
export async function startProbe() {
  const server = createProbe().listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Test address missing");
  return {
    url: "http://127.0.0.1:" + address.port,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}
