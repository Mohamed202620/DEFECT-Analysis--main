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
  deleteDoc
} from 'firebase/firestore';

export {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  deleteUser
} from 'firebase/auth';

export {
  getStorage
} from 'firebase/storage';
