import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import LogoutModal from './components/LogoutModal.jsx';
import Home from './pages/Home.jsx';
import Contact from './pages/Contact.jsx';
import Student from './pages/Student.jsx';
import Company from './pages/Company.jsx';
import Profile from './pages/Profile.jsx';
import LoginRegister from './pages/LoginRegister.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Disclaimer from './pages/Disclaimer.jsx';
import PrivacyPolicy from './pages/PrivacyPolicy.jsx';
import TermsAndConditions from './pages/TermsAndConditions.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user')) || null;
    } catch (error) {
      return null;
    }
  });
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        setUser(null);
        localStorage.removeItem('user');
        setAuthLoading(false);
        return;
      }

      (async () => {
        let role = localStorage.getItem(`ss_user_role_${currentUser.uid}`) || localStorage.getItem(`ss_user_role_${currentUser.email}`) || null;
        if (!role) {
          try {
            const userSnapshot = await getDoc(doc(db, 'users', currentUser.uid));
            if (userSnapshot.exists()) {
              role = userSnapshot.data()?.role || null;
            }
          } catch (error) {
            console.error('Error loading user role:', error);
          }
        }

        const stored = {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
          emailVerified: currentUser.emailVerified,
          role
        };
        setUser(stored);
        localStorage.setItem('user', JSON.stringify(stored));
        setAuthLoading(false);
      })();
    });

    return () => unsubscribe();
  }, []);

  const handleLogoutConfirm = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
    setLogoutOpen(false);
    navigate('/login');
  };

  const handleSectionSelect = (section) => {
    if (location.pathname !== '/') {
      navigate('/', { state: { scrollTo: section } });
      return;
    }
    navigate('/', { state: { scrollTo: section } });
  };

  return (
    <div className="app-shell">
      <Navbar
        user={user}
        onSectionSelect={handleSectionSelect}
        onLogoutClick={() => setLogoutOpen(true)}
      />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/contact" element={<Contact />} />
          <Route
            path="/student"
            element={
              <ProtectedRoute user={user} authLoading={authLoading} requiredRole="student">
                <Student user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company"
            element={
              <ProtectedRoute user={user} authLoading={authLoading} requiredRole="startup">
                <Company user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute user={user} authLoading={authLoading}>
                <Profile user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/login"
            element={!authLoading && user ? <Navigate to={user.role === 'startup' ? '/company' : '/student'} replace /> : <LoginRegister />}
          />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/disclaimer" element={<Disclaimer />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<PrivacyPolicy />} />
        </Routes>
      </main>
      <Footer onSectionSelect={handleSectionSelect} />
      <LogoutModal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={handleLogoutConfirm}
      />
    </div>
  );
}

export default App;
