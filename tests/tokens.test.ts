import { test } from "node:test";
import assert from "node:assert/strict";
import { generateToken, hashToken, isWellFormedToken, safeEqual, verifyToken } from "../src/lib/tokens";

test("tokens are 32 bytes of entropy, url-safe and unique", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 500; i++) {
    const t = generateToken();
    assert.match(t, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(Buffer.from(t, "base64url").length, 32);
    seen.add(t);
  }
  assert.equal(seen.size, 500);
});

test("hashToken is a deterministic sha-256 hex digest that differs from the token", () => {
  const t = generateToken();
  assert.equal(hashToken(t), hashToken(t));
  assert.match(hashToken(t), /^[0-9a-f]{64}$/);
  assert.notEqual(hashToken(t), t);
  assert.notEqual(hashToken(t), hashToken(generateToken()));
});

test("verifyToken accepts the right token only", () => {
  const t = generateToken();
  const h = hashToken(t);
  assert.equal(verifyToken(t, h), true);
  assert.equal(verifyToken(generateToken(), h), false);
  assert.equal(verifyToken(t, null), false);
  assert.equal(verifyToken("short", h), false);
  assert.equal(verifyToken(t, h.toUpperCase()), false);
});

test("isWellFormedToken rejects bad shapes", () => {
  assert.equal(isWellFormedToken(undefined), false);
  assert.equal(isWellFormedToken("a".repeat(42)), false);
  assert.equal(isWellFormedToken("a".repeat(44)), false);
  assert.equal(isWellFormedToken("a".repeat(42) + "!"), false);
  assert.equal(isWellFormedToken("a".repeat(43)), true);
});

test("safeEqual compares strings of different length without throwing", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abcd"), false);
  assert.equal(safeEqual("", ""), true);
});
