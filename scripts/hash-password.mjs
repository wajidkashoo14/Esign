// Usage: npm run hash-password -- "my password"
import bcrypt from "bcryptjs";

const pw = process.argv[2];
if (!pw || pw.length < 10) {
  console.error('Usage: npm run hash-password -- "a password of 10+ characters"');
  process.exit(1);
}
const hash = bcrypt.hashSync(pw, 12);
console.log("\nFor .env / .env.local (dollar signs escaped):");
console.log(`OWNER_PASSWORD_HASH="${hash.replaceAll("$", "\$")}"`);
console.log("\nFor Vercel / other dashboards (raw):");
console.log(hash);
