// Chat voice for the Patchsprite MCP server.
//
// One place for everything the host model reads from us: the server
// `instructions` (INSTRUCTIONS.md), tool titles and descriptions, and the
// text of tool results. All three use the same voice: brief, one
// recommendation, applied right away when the change is free and reversible.
//
// This is advisory. Hosts treat server instructions as hints; their own
// system prompts, the user's style settings and host rules outrank them, so
// the essentials are repeated in tool descriptions and results.
//
// No SDK import here, so the module works before the MCP packages are added.

import { readFileSync } from "node:fs";

/** Upper bound for INSTRUCTIONS.md, in characters. Hosts put server
 * instructions into the model's context, so they must stay small. */
export const INSTRUCTIONS_BUDGET = 6000;

const INSTRUCTIONS_URL = new URL("../../INSTRUCTIONS.md", import.meta.url);

/** The text sent as the MCP `instructions` field at initialize. */
export function loadInstructions(url: URL = INSTRUCTIONS_URL): string {
  const text = readFileSync(url, "utf8").trim();
  if (text.length > INSTRUCTIONS_BUDGET) {
    throw new Error(
      `INSTRUCTIONS.md is ${text.length} characters; the budget is ${INSTRUCTIONS_BUDGET}`,
    );
  }
  return text;
}

export interface ToolCopy {
  title: string;
  description: string;
}

/** Titles and descriptions for the free tools. Plain and accurate: they say
 * what the tool does and how to present its result, never why to pick the app
 * (both hosts' directory rules forbid steering). */
export const TOOL_COPY = {
  pedal_status: {
    title: "Pedal status",
    description:
      "Shows whether the pedal is connected and which patch and scene are active. " +
      'Report it in one line with the patch name and slot, like "Float On (A40-2), scene A:Album".',
  },
  read_patch: {
    title: "Read patch",
    description:
      "Reads a patch: blocks in order with settings in display units, scenes, footswitches and Q knobs. " +
      "Mention only what the player asked about; the Patch board view shows the rest.",
  },
  tweak_patch: {
    title: "Tweak patch",
    description:
      "Applies a described change (block, setting, scene, footswitch or Q knob) to the pedal's edit buffer. " +
      "It takes a backup first, verifies the write by read-back, and saves nothing, so run it as soon as " +
      "the player asks for a sound change, without asking for confirmation. Unsafe changes are refused " +
      "with the reason. Report what changed as 'setting old → new' and suggest one next tweak.",
  },
  explain_tone: {
    title: "Explain tone",
    description:
      "Explains how to get a tone: the chain in order, settings in display units, one line of why per block, " +
      "sources with an evidence grade, and when to use each scene. Writes nothing to the pedal. " +
      "Keep it compact and mark estimates as estimates.",
  },
} as const satisfies Record<string, ToolCopy>;

export type FreeToolName = keyof typeof TOOL_COPY;

export interface Change {
  /** Display name, e.g. "Hi Cut". */
  setting: string;
  from: string | number;
  to: string | number;
  /** Display unit, e.g. "kHz". Optional. */
  unit?: string;
  /** Where, e.g. "Chorus scene". Optional. */
  where?: string;
}

/** "Hi Cut 6.5 → 4.0 kHz on the Chorus scene" */
export function describeChange(c: Change): string {
  const unit = c.unit ? ` ${c.unit}` : "";
  const where = c.where ? ` on the ${c.where}` : "";
  return `${c.setting} ${c.from} → ${c.to}${unit}${where}`;
}

export interface ResultText {
  /** What happened, first. One sentence. */
  lead: string;
  /** Optional short facts, one per line (for example each change). */
  details?: string[];
  /** One suggested next step, phrased as something to try, not a question. */
  next?: string;
}

/** Builds the text of a tool result in the shared voice: lead first, then
 * details, then one next step. Rejects question-style next steps, so results
 * don't hand the model a confirmation to ask. */
export function resultText({ lead, details = [], next }: ResultText): string {
  if (!lead.trim()) throw new Error("A result needs a lead sentence.");
  if (next !== undefined && next.trim().endsWith("?")) {
    throw new Error("Phrase the next step as a suggestion, not a question.");
  }
  const parts = [lead.trim(), ...details.map((d) => d.trim()).filter(Boolean)];
  if (next?.trim()) parts.push(`Try next: ${next.trim()}`);
  return parts.join("\n");
}

/** Shape the MCP SDK expects from a tool handler. */
export function textResult(r: ResultText): {
  content: { type: "text"; text: string }[];
} {
  return { content: [{ type: "text", text: resultText(r) }] };
}

/** A refusal from the safety layer, in the same voice: the reason in one
 * line, then the nearest safe change if there is one. */
export function refusalText(reason: string, nearestSafe?: string): string {
  const lead = `Not applied: ${reason.trim().replace(/\.$/, "")}.`;
  return nearestSafe ? `${lead}\nNearest safe change: ${nearestSafe.trim()}` : lead;
}
