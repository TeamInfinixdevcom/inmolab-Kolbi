import { serverTimestamp } from "firebase/firestore";

export function creationAudit(uid: string) {
  return {
    createdBy: uid,
    updatedBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export function updateAudit(uid: string) {
  return {
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  };
}
