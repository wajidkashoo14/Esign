import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDocument, parseInline } from "../src/lib/markdown";

test("inline bold, including unmatched markers left as text", () => {
  assert.deepEqual(parseInline("a **b** c"), [
    { text: "a ", bold: false },
    { text: "b", bold: true },
    { text: " c", bold: false },
  ]);
  assert.deepEqual(parseInline("2 ** 3 and **x"), [{ text: "2 ** 3 and **x", bold: false }]);
});

test("headings, paragraphs with line breaks, lists and rules", () => {
  const doc = parseDocument("# Title\n\nLine one\nline two\n\n## 1. Terms\n1. First\n2. Second\n   continued\n\n- a\n- b\n\n---\nEnd");
  assert.deepEqual(
    doc.map((b) => b.type),
    ["heading", "paragraph", "heading", "list", "list", "hr", "paragraph"],
  );
  assert.equal(doc[0]!.type === "heading" && doc[0]!.level, 1);
  assert.equal(doc[1]!.type === "paragraph" && doc[1]!.content[0]!.text, "Line one\nline two");
  const ol = doc[3]!;
  assert.ok(ol.type === "list" && ol.ordered);
  if (ol.type === "list") {
    assert.deepEqual(ol.items.map((i) => i.marker), ["1.", "2."]);
    assert.equal(ol.items[1]!.content[0]!.text, "Second\ncontinued");
  }
  const ul = doc[4]!;
  assert.ok(ul.type === "list" && !ul.ordered && ul.items[0]!.marker === "•");
});

test("original list numbers are kept (clauses can start anywhere)", () => {
  const [l] = parseDocument("3. Third\n4. Fourth");
  assert.ok(l?.type === "list");
  if (l?.type === "list") assert.deepEqual(l.items.map((i) => i.marker), ["3.", "4."]);
});

test("text that looks like HTML stays plain text", () => {
  const [p] = parseDocument("<script>alert(1)</script>");
  assert.ok(p?.type === "paragraph");
  if (p?.type === "paragraph") assert.equal(p.content[0]!.text, "<script>alert(1)</script>");
});
