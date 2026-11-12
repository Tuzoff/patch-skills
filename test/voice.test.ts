import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INSTRUCTIONS_BUDGET,
  TOOL_COPY,
  describeChange,
  loadInstructions,
  refusalText,
  resultText,
} from "../src/mcp/voice.ts";

const instructions = loadInstructions();

test("INSTRUCTIONS.md stays within its budget", () => {
  assert.ok(instructions.length > 0);
  assert.ok(instructions.length <= INSTRUCTIONS_BUDGET);
});

test("every tool is documented in INSTRUCTIONS.md", () => {
  for (const name of Object.keys(TOOL_COPY)) {
    assert.ok(instructions.includes(`\`${name}\``), `${name} missing from INSTRUCTIONS.md`);
  }
});

test("INSTRUCTIONS.md names no tool we don't register", () => {
  const known = new Set(Object.keys(TOOL_COPY));
  const named = [...instructions.matchAll(/`([a-z]+_[a-z_]+)`/g)].map((m) => m[1]);
  for (const name of named) assert.ok(known.has(name), `unknown tool ${name}`);
});

test("INSTRUCTIONS.md has the four required parts", () => {
  for (const heading of ["## Voice", "## Features", "## Examples", "## What is safe without asking"]) {
    assert.ok(instructions.includes(heading), `missing ${heading}`);
  }
});

test("instructions and tool copy carry no device protocol data", () => {
  // Hex bytes or SysEx frames would mean a mapping leaked into the voice text.
  const all = instructions + JSON.stringify(TOOL_COPY);
  assert.doesNotMatch(all, /0x[0-9a-f]{2}/i);
  assert.doesNotMatch(all, /\bF0(\s[0-9A-F]{2}){2,}/);
});

test("tool descriptions are plain statements, not questions", () => {
  for (const [name, copy] of Object.entries(TOOL_COPY)) {
    assert.ok(copy.description.length <= 600, `${name} description too long`);
    assert.ok(!copy.description.trim().endsWith("?"), `${name} ends with a question`);
  }
});

test("describeChange uses display units and arrows", () => {
  assert.equal(
    describeChange({ setting: "Hi Cut", from: "6.5", to: "4.0", unit: "kHz", where: "Chorus scene" }),
    "Hi Cut 6.5 → 4.0 kHz on the Chorus scene",
  );
  assert.equal(describeChange({ setting: "Gain", from: 6, to: 4.5 }), "Gain 6 → 4.5");
});

test("resultText leads with the change and ends with one suggestion", () => {
  const text = resultText({
    lead: "Applied to Float On (A40-2), not saved.",
    details: ["Hi Cut 6.5 → 4.0 kHz on the Chorus scene"],
    next: "if it's too dark, ask for brighter",
  });
  assert.equal(
    text,
    "Applied to Float On (A40-2), not saved.\nHi Cut 6.5 → 4.0 kHz on the Chorus scene\nTry next: if it's too dark, ask for brighter",
  );
});

test("resultText refuses a question as the next step", () => {
  assert.throws(() => resultText({ lead: "Done.", next: "Shall I save it?" }));
  assert.throws(() => resultText({ lead: " " }));
});

test("refusalText gives the reason and the nearest safe change", () => {
  assert.equal(
    refusalText("this firmware doesn't list that model.", "the closest fuzz it has"),
    "Not applied: this firmware doesn't list that model.\nNearest safe change: the closest fuzz it has",
  );
});
