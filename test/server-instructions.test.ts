// Integration check: a client connected to the server receives
// INSTRUCTIONS.md as the server instructions and the shared tool copy.
// Needs @modelcontextprotocol/sdk and zod; skipped when they aren't installed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TOOL_COPY, loadInstructions, textResult } from "../src/mcp/voice.ts";

let sdk: {
  McpServer: any;
  Client: any;
  InMemoryTransport: any;
  z: any;
} | null = null;
try {
  const [{ McpServer }, { Client }, { InMemoryTransport }, { z }] = await Promise.all([
    import("@modelcontextprotocol/sdk/server/mcp.js"),
    import("@modelcontextprotocol/sdk/client/index.js"),
    import("@modelcontextprotocol/sdk/inMemory.js"),
    import("zod"),
  ]);
  sdk = { McpServer, Client, InMemoryTransport, z };
} catch {
  sdk = null;
}

test("client receives the instructions and tool copy", { skip: sdk === null }, async () => {
  const { McpServer, Client, InMemoryTransport, z } = sdk!;
  const server = new McpServer(
    { name: "patch-skills", version: "0.0.0" },
    { instructions: loadInstructions() },
  );
  server.registerTool(
    "tweak_patch",
    { ...TOOL_COPY.tweak_patch, inputSchema: { change: z.string() } },
    async () =>
      textResult({
        lead: "Applied to Float On (A40-2), not saved.",
        details: ["Hi Cut 6.5 → 4.0 kHz on the Chorus scene"],
        next: "if it's too dark, ask for brighter",
      }),
  );

  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

  assert.equal(client.getInstructions(), loadInstructions());

  const { tools } = await client.listTools();
  assert.equal(tools[0].description, TOOL_COPY.tweak_patch.description);

  const res = await client.callTool({ name: "tweak_patch", arguments: { change: "less fizz" } });
  assert.match(res.content[0].text, /^Applied to Float On \(A40-2\), not saved\./);
  await client.close();
});
