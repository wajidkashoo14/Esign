import { test } from "node:test";
import assert from "node:assert/strict";
import { documentHash, sha256Hex } from "../src/lib/hash";

test("sha256Hex matches known vectors", () => {
  assert.equal(sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(sha256Hex(new TextEncoder().encode("abc")), sha256Hex("abc"));
});

test("documentHash is stable and sensitive to every character of title and body", () => {
  const h = documentHash("NDA", "Hello Bob");
  assert.equal(h, documentHash("NDA", "Hello Bob"));
  assert.notEqual(h, documentHash("NDA ", "Hello Bob"));
  assert.notEqual(h, documentHash("NDA", "Hello Bob."));
  assert.notEqual(h, documentHash("NDAHello", " Bob"), "title/body boundary is unambiguous");
});
