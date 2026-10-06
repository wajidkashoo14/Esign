import { test } from "node:test";
import assert from "node:assert/strict";
import { checkOtp, generateOtp, hashOtp, maskEmail } from "../src/lib/otp";
import { base32Decode, base32Encode, generateTotpSecret, hotp, isValidTotpSecret, otpauthUri, verifyTotp } from "../src/lib/totp";

const RFC_KEY = Buffer.from("12345678901234567890");

test("HOTP/TOTP match the RFC 4226 / RFC 6238 test vectors", () => {
  assert.equal(hotp(RFC_KEY, 0), "755224");
  assert.equal(hotp(RFC_KEY, 9), "520489");
  assert.equal(hotp(RFC_KEY, 1, 8), "94287082"); // T = 59s
  assert.equal(hotp(RFC_KEY, Math.floor(1111111109 / 30), 8), "07081804");
  assert.equal(hotp(RFC_KEY, Math.floor(1234567890 / 30), 8), "89005924");
});

test("base32 round-trips and secrets are 160-bit", () => {
  assert.equal(base32Encode(Buffer.from("foobar")), "MZXW6YTBOI");
  assert.deepEqual(base32Decode("mzxw 6ytb oi=="), Buffer.from("foobar"));
  const s = generateTotpSecret();
  assert.equal(base32Decode(s).length, 20);
  assert.ok(isValidTotpSecret(s));
  assert.equal(isValidTotpSecret("not base32!"), false);
  assert.equal(isValidTotpSecret("ABCD"), false, "too short");
});

test("verifyTotp accepts the current and adjacent steps only", () => {
  const secret = base32Encode(RFC_KEY);
  const now = 59_000; // counter 1
  assert.equal(verifyTotp(secret, "287082", now), 1);
  assert.equal(verifyTotp(secret, hotp(RFC_KEY, 2), now), 2);
  assert.equal(verifyTotp(secret, hotp(RFC_KEY, 0), now), 0);
  assert.equal(verifyTotp(secret, hotp(RFC_KEY, 3), now), null);
  assert.equal(verifyTotp(secret, "12345", now), null);
  assert.equal(verifyTotp("!!!", "287082", now), null);
  assert.match(otpauthUri(secret, "me@example.com", "E-Sign"), /^otpauth:\/\/totp\/E-Sign:me%40example\.com\?secret=/);
});

test("email codes: 6 digits, keyed hash bound to the signer", () => {
  const code = generateOtp();
  assert.match(code, /^\d{6}$/);
  const h = hashOtp(code, "signer1", "s".repeat(40));
  assert.ok(checkOtp(code, "signer1", "s".repeat(40), h));
  assert.equal(checkOtp(code, "signer2", "s".repeat(40), h), false, "bound to signer");
  assert.equal(checkOtp(code, "signer1", "t".repeat(40), h), false, "bound to server secret");
  assert.equal(checkOtp("abcdef", "signer1", "s".repeat(40), h), false);
  assert.equal(checkOtp(code, "signer1", "s".repeat(40), null), false);
});

test("maskEmail hides most of the local part", () => {
  assert.equal(maskEmail("asha.kumar@example.com"), "as••••••••@example.com");
  assert.equal(maskEmail("ab@x.io"), "a•@x.io");
  assert.equal(maskEmail("a@x.io"), "a•@x.io");
});
