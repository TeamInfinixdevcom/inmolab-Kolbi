import "dotenv/config";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";


const [uid, role] = process.argv.slice(2);
const roles = new Set(["ADMIN", "SUPERVISOR", "AGENTE"]);
if (!uid || !roles.has(role)) {
  throw new Error("Uso: node scripts/set-custom-claims.mjs <uid> <ADMIN|SUPERVISOR|AGENTE>");
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) {
  throw new Error("Configura FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY.");
}

const app = getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
await getAuth(app).setCustomUserClaims(uid, { role });
console.log(`Rol ${role} asignado a ${uid}. El usuario debe renovar su token.`);
