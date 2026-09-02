import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, orderBy, limit } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBocUzghhDY2eY9Dg8B-UwlV-ye844_DtA",
  authDomain: "maintenance-defect-system.firebaseapp.com",
  projectId: "maintenance-defect-system",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  try {
    const snap = await getDocs(query(collection(db, "tickets"), orderBy("createdAt", "desc"), limit(2000)));
    console.log("Total tickets in DB:", snap.size);
    if(snap.size > 0) {
      console.log(snap.docs[0].data().createdAt);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
  process.exit(0);
}
test();
