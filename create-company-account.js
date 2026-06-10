import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD8FLY3Yo6g8eAFJMTgPuOaH_Rv5XIojas",
  authDomain: "skillstreetofficial.firebaseapp.com",
  projectId: "skillstreetofficial",
  storageBucket: "skillstreetofficial.firebasestorage.app",
  messagingSenderId: "1518002311",
  appId: "1:1518002311:web:24acfa0a6e7fa84e951822",
  measurementId: "G-JXWT315DGQ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function createCompanyAccount() {
  const companyEmail = 'demo@skillstreet.com';
  const companyPassword = 'Demo123456';
  const companyName = 'Demo Company';

  try {
    console.log('Creating company account...');
    const userCredential = await createUserWithEmailAndPassword(auth, companyEmail, companyPassword);
    const user = userCredential.user;
    
    await updateProfile(user, { displayName: companyName });
    
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: companyName,
      role: 'startup',
      createdAt: serverTimestamp()
    });

    console.log('✅ Company account created successfully!');
    console.log('📧 Email:', companyEmail);
    console.log('🔑 Password:', companyPassword);
    console.log('🏢 Company Name:', companyName);
    console.log('\nYou can now login with these credentials at http://localhost:5173');
    
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('⚠️  Account already exists with this email.');
      console.log('📧 Email:', companyEmail);
      console.log('🔑 Password:', companyPassword);
      console.log('🏢 Company Name:', companyName);
      console.log('\nYou can login with these credentials at http://localhost:5173');
    } else {
      console.error('❌ Error creating account:', error.message);
    }
  }
}

createCompanyAccount();
