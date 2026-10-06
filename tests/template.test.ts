import { test } from "node:test";
import assert from "node:assert/strict";
import { extractVariables, missingVariables, renderTemplate } from "../src/lib/template";
import { cleanLine, cleanText, escapeHtml } from "../src/lib/sanitize";

test("extractVariables finds unique names in order", () => {
  assert.deepEqual(extractVariables("Hi {{ name }}, {{amount}} for {{name}}. {{ 1bad }} {{ok_2}}"), ["name", "amount", "ok_2"]);
});

test("renderTemplate substitutes once and never re-expands values", () => {
  assert.equal(renderTemplate("A {{x}} B {{y}}", { x: "{{y}}", y: "Z" }), "A {{y}} B Z");
  assert.equal(renderTemplate("{{unknown}}", {}), "{{unknown}}");
  assert.equal(renderTemplate("{{toString}}", {}), "{{toString}}", "prototype keys are not variables");
});

test("missingVariables flags blank values", () => {
  assert.deepEqual(missingVariables("{{a}} {{b}} {{c}}", { a: "1", b: "  " }), ["b", "c"]);
});

test("sanitizers strip control and bidi characters", () => {
  assert.equal(cleanText("a\u0000b‮c\r\nd\te", 100), "abc\nd\te");
  assert.equal(cleanLine("  a \n  b\t c ", 100), "a b c");
  assert.equal(cleanLine("x".repeat(50), 10).length, 10);
  assert.equal(escapeHtml(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
});
