// Generates a VAPID key pair for Web Push. Run locally: node scripts/generate-vapid-keys.mjs
// Use a SEPARATE pair for the dev Worker and the production Worker. Never commit the private key.
import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const pub = publicKey.export({ format: "jwk" });
const priv = privateKey.export({ format: "jwk" });
const publicRaw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, "base64url"), Buffer.from(pub.y, "base64url")]);
console.log("VAPID_PUBLIC_KEY=" + publicRaw.toString("base64url"));
console.log("VAPID_PRIVATE_KEY=" + priv.d);
