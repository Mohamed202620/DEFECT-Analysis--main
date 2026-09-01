import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBocUzghhDY2eY9Dg8B-UwlV-ye844_DtA",
  authDomain: "maintenance-defect-system.firebaseapp.com",
  projectId: "maintenance-defect-system"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const usersRef = collection(db, "users");
  const snap = await getDocs(usersRef);
  snap.forEach(doc => {
    console.log(doc.id, doc.data());
  });
  console.log("Done");
  process.exit(0);
}
check();
