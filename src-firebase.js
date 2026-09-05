export {
  initializeApp,
  getApps,
  getApp
} from 'firebase/app';

export {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  deleteDoc,
  getCountFromServer
} from 'firebase/firestore';

export {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  deleteUser,
  onAuthStateChanged
} from 'firebase/auth';

export {
  getStorage
} from 'firebase/storage';

// ⚠️ إضافة مرجعية غير مُفعّلة بعد (بند F/الأمان في تقرير المراجعة -
// نقل IMGBB_API_KEY لسيرفر وسيط بدل كشفه في كود العميل). لازم
// npm run build بعد إضافة السطر ده عشان ينعكس في js/firebase.js
// الفعلي، وبعدين تفعيل js/providers/storage/serverProxyStorageProvider.js
// (راجع الملف نفسه وfunctions/README.md قبل أي تفعيل).
export {
  getFunctions,
  httpsCallable
} from 'firebase/functions';
