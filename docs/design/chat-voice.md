# Chat voice

Decided 2026-11-12. Plan: "Chat voice and instructions file" under MCP app layer, requirement F13.

The MCP server steers how the host chat talks while it uses our tools: conversational and brief, it recommends one change and applies it right away so the player hears it, with no confirmation step. That is safe for free tweaks only, because they land in the edit buffer, unsaved, after a backup. Saving and paid runs still need the player's word.

## Where the voice lives

| Channel | File | Reaches |
| --- | --- | --- |
| Server `instructions` (sent at initialize) | `INSTRUCTIONS.md` | Hosts that read server instructions |
| Tool titles and descriptions | `src/mcp/voice.ts` (`TOOL_COPY`) | Every host |
| Tool result text | `src/mcp/voice.ts` (`textResult`, `describeChange`, `refusalText`) | Every host |

`INSTRUCTIONS.md` holds the voice rules, what is safe without asking, the feature list (what the player says, which tool, which view), the tone-answer order, and example exchanges.

## Wiring

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TOOL_COPY, loadInstructions, textResult, describeChange } from "./voice.ts";

const server = new McpServer(
  { name: "patch-skills", version },
  { instructions: loadInstructions() },
);

server.registerTool("tweak_patch", { ...TOOL_COPY.tweak_patch, inputSchema }, async (args) => {
  const r = await applyTweak(args); // existing safety-layer path
  return textResult({
    lead: `Applied to ${r.patchLabel}, not saved.`,
    details: r.changes.map(describeChange),
    next: r.suggestion,
  });
});
```

Register every free tool with its `TOOL_COPY` entry. The tests fail when a tool is in `TOOL_COPY` but missing from `INSTRUCTIONS.md`, when the file names an unknown tool, when it passes the 6,000-character budget, or when a result's next step is phrased as a question.

## Limits

- Advisory only. Host system prompts, the player's own style settings and host rules outrank server instructions, and some hosts may not read them. The essentials are therefore repeated in tool descriptions and results.
- Host rules. The text shapes how results are presented once the player is using the app. It never tells the model to prefer the app. The ChatGPT build carries no price or upgrade lines.
- Open and closed. This file covers the free tools. The closed plugin appends its paid sections (quote, build, match, review, save) at build time.
- No vendor files, model catalogs or protocol bytes in any of this text; a test checks for hex and SysEx-looking sequences.

## Backlog

An in-app chatbot inside the MCP view would guarantee the voice and a persona, at the cost of our own model calls and the main chat's context. See the plan's Backlog ideas.
