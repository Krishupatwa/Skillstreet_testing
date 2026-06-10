import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  TwitterAuthProvider,
  GithubAuthProvider,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendEmailVerification
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const providers = {
  facebook: new FacebookAuthProvider(),
  google: new GoogleAuthProvider(),
  twitter: new TwitterAuthProvider(),
  github: new GithubAuthProvider()
};

export default function LoginRegister() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pills-login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerRepeatPassword, setRegisterRepeatPassword] = useState('');
  const [registerRole, setRegisterRole] = useState('student');
  const [passwordErrorVisible, setPasswordErrorVisible] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [authType, setAuthType] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [unverifiedUser, setUnverifiedUser] = useState(null);

  const showMessage = (message, type) => {
    setAuthMessage(message);
    setAuthType(type);
    setTimeout(() => {
      setAuthMessage('');
      setAuthType('');
    }, 5000);
  };

  const handleResendVerification = async () => {
    if (!unverifiedUser) return;
    
    setResendLoading(true);
    try {
      await sendEmailVerification(unverifiedUser);
      showMessage('Verification email resent! Check your inbox.', 'success');
      
      // Set cooldown for 60 seconds
      setResendCooldown(60);
      const countdown = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            clearInterval(countdown);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      console.error('Resend error:', error);
      showMessage('Failed to resend verification email. Try again later.', 'error');
    } finally {
      setResendLoading(false);
    }
  };

  const switchTab = (tabId) => {
    setAuthMessage('');
    setAuthType('');
    setActiveTab(tabId);
  };

  const handleSocialSignIn = async (providerName) => {
    try {
      const provider = providers[providerName] || providers.google;
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userRef = doc(db, 'users', user.uid);
      const userSnapshot = await getDoc(userRef);
      let role = localStorage.getItem(`ss_user_role_${user.uid}`) || localStorage.getItem(`ss_user_role_${user.email}`) || null;

      if (userSnapshot.exists()) {
        role = userSnapshot.data()?.role || role;
      }

      if (!role) {
        role = 'student';
      }

      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || '',
        role,
        lastLoginAt: serverTimestamp()
      }, { merge: true });

      localStorage.setItem(`ss_user_role_${user.uid}`, role);
      localStorage.setItem('user', JSON.stringify({ uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL, role }));
      showMessage(`Welcome ${user.displayName || user.email}! Redirecting...`, 'success');
      const targetDashboard = role === 'startup' ? '/company' : '/student';
      setTimeout(() => navigate(targetDashboard), 2000);
    } catch (error) {
      showMessage(error.message, 'error');
      console.error('Auth error:', error);
    }
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const user = userCredential.user;
      if (!user.emailVerified) {
        setUnverifiedUser(user);
        showMessage('Please verify your email before logging in. Check your inbox for the verification link.', 'error');
        await auth.signOut();
        return;
      }
      const userRef = doc(db, 'users', user.uid);
      const userSnapshot = await getDoc(userRef);
      let role = localStorage.getItem(`ss_user_role_${user.uid}`) || localStorage.getItem(`ss_user_role_${user.email}`) || null;
      if (userSnapshot.exists()) {
        role = userSnapshot.data()?.role || role;
      }
      const stored = { uid: user.uid, email: user.email, displayName: user.displayName, role: role || 'student' };
      if (!role) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || '',
          role: stored.role,
          lastLoginAt: serverTimestamp()
        }, { merge: true });
      }
      localStorage.setItem(`ss_user_role_${user.uid}`, stored.role);
      localStorage.setItem('user', JSON.stringify(stored));
      showMessage('Login successful! Redirecting...', 'success');
      const targetDashboard = stored.role === 'startup' ? '/company' : '/student';
      setTimeout(() => navigate(targetDashboard), 1500);
    } catch (error) {
      let errorMessage = 'Login failed. Please try again.';
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many attempts. Please try again later.';
          break;
      }
      showMessage(errorMessage, 'error');
      console.error('Login error:', error);
    }
  };

  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    if (registerPassword !== registerRepeatPassword) {
      setPasswordErrorVisible(true);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, registerEmail, registerPassword);
      const user = userCredential.user;
      await updateProfile(user, { displayName: registerUsername });
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: registerUsername,
        role: registerRole,
        createdAt: serverTimestamp()
      });
      const storedUser = {
        uid: user.uid,
        email: user.email,
        displayName: registerUsername,
        role: registerRole,
        photoURL: user.photoURL || null,
        emailVerified: user.emailVerified
      };
      localStorage.setItem(`ss_user_role_${user.uid}`, registerRole);
      localStorage.setItem('user', JSON.stringify(storedUser));
      await sendEmailVerification(user);
      showMessage('Account created! Redirecting to your dashboard...', 'success');
      setTimeout(() => navigate(registerRole === 'startup' ? '/company' : '/student'), 1500);
    } catch (error) {
      let errorMessage = 'Registration failed. Please try again.';
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'An account with this email already exists.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password should be at least 6 characters.';
          break;
      }
      showMessage(errorMessage, 'error');
      console.error('Registration error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 via-blue-950 to-black text-white pt-28 sm:pt-24 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl">
        <div className="space-y-3 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-orange-300">Welcome back to</p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold">SkillStreet Login & Registration</h1>
          <p className="mx-auto max-w-2xl text-sm text-slate-300 sm:text-base">Access your student dashboard or company workspace with a secure login, or create a new account in seconds.</p>
        </div>

        <div className="flex flex-col gap-4 rounded-[1.5rem] bg-blue-900/30 p-4 sm:p-6">
          <div className="grid grid-cols-2 rounded-full bg-blue-900/60 border border-blue-800/60 p-1 text-sm text-slate-300 shadow-inner sm:text-base">
            <button
              type="button"
              className={`rounded-full py-3 font-semibold transition-all ${activeTab === 'pills-login' ? 'bg-blue-800 text-white shadow-lg' : 'text-slate-300 hover:text-white'}`}
              onClick={() => switchTab('pills-login')}
            >
              Login
            </button>
            <button
              type="button"
              className={`rounded-full py-3 font-semibold transition-all ${activeTab === 'pills-register' ? 'bg-blue-800 text-white shadow-lg' : 'text-slate-300 hover:text-white'}`}
              onClick={() => switchTab('pills-register')}
            >
              Register
            </button>
          </div>

          {authMessage ? (
            <div className={`rounded-2xl border px-4 py-3 text-center text-sm ${authType === 'error' ? 'border-red-400 bg-red-500/10 text-red-200' : 'border-emerald-400 bg-emerald-500/10 text-emerald-200'}`}>
              <div>{authMessage}</div>
              {authType === 'error' && unverifiedUser && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendLoading || resendCooldown > 0}
                  className="mt-3 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:bg-slate-600 px-4 py-2 text-xs font-semibold text-slate-950 transition"
                >
                  {resendLoading ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Verification Email'}
                </button>
              )}
            </div>
          ) : null}

          <div className="grid gap-8 md:grid-cols-[0.85fr_1fr]">
            <div className="space-y-6 rounded-[1.5rem] bg-blue-900/60 border border-blue-800/60 p-4 sm:p-6">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold">Quick access</h2>
                <p className="mt-2 text-sm text-slate-300">Choose your account type and use social sign-in or the secure form.</p>
              </div>
              <div className="grid gap-3">
                <button type="button" onClick={() => handleSocialSignIn('google')} className="rounded-2xl border border-blue-800/60 bg-blue-900/50 px-4 py-3 text-left text-white transition hover:border-orange-400 hover:bg-blue-800">
                  <span className="font-semibold">Continue with Google</span>
                </button>
                <button type="button" onClick={() => handleSocialSignIn('facebook')} className="rounded-2xl border border-blue-800/60 bg-blue-900/50 px-4 py-3 text-left text-white transition hover:border-orange-400 hover:bg-blue-800">
                  <span className="font-semibold">Continue with Facebook</span>
                </button>
                <button type="button" onClick={() => handleSocialSignIn('twitter')} className="rounded-2xl border border-blue-800/60 bg-blue-900/50 px-4 py-3 text-left text-white transition hover:border-orange-400 hover:bg-blue-800">
                  <span className="font-semibold">Continue with Twitter</span>
                </button>
                <button type="button" onClick={() => handleSocialSignIn('github')} className="rounded-2xl border border-blue-800/60 bg-blue-900/50 px-4 py-3 text-left text-white transition hover:border-orange-400 hover:bg-blue-800">
                  <span className="font-semibold">Continue with GitHub</span>
                </button>
              </div>
            </div>

            <div className="rounded-[1.5rem] bg-blue-900/30 p-4 sm:p-6 shadow-lg">
              {activeTab === 'pills-login' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="loginEmail" className="block text-sm font-medium text-slate-300">Email</label>
                    <input
                      type="email"
                      id="loginEmail"
                      className="w-full rounded-2xl border border-white/10 bg-blue-900/50 px-4 py-3 text-white outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="loginPassword" className="block text-sm font-medium text-slate-300">Password</label>
                    <input
                      type="password"
                      id="loginPassword"
                      className="w-full rounded-2xl border border-white/10 bg-blue-900/50 px-4 py-3 text-white outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                      <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-blue-800/60 bg-blue-900/50 text-orange-400 focus:ring-orange-400" />
                      Remember me
                    </label>
                    <Link to="/forgot-password" className="text-sm text-orange-300 hover:text-orange-400">Forgot password?</Link>
                  </div>

                  <button type="submit" className="w-full rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-400">Login</button>

                  <p className="text-center text-sm text-slate-300">Not a member? <button type="button" onClick={() => switchTab('pills-register')} className="font-semibold text-orange-300 hover:text-orange-400">Register now</button></p>
                </form>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="registerUsername" className="block text-sm font-medium text-slate-300">Username</label>
                    <input
                      type="text"
                      id="registerUsername"
                      className="w-full rounded-2xl border border-white/10 bg-blue-900/50 px-4 py-3 text-white outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                      value={registerUsername}
                      onChange={(e) => setRegisterUsername(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="registerEmail" className="block text-sm font-medium text-slate-300">Email</label>
                    <input
                      type="email"
                      id="registerEmail"
                      className="w-full rounded-2xl border border-white/10 bg-blue-900/50 px-4 py-3 text-white outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      required
                    />
                  </div>

                  <fieldset className="space-y-3 rounded-2xl border border-blue-800/60 bg-blue-900/50 p-4">
                    <legend className="text-sm font-medium text-slate-300">Account Type</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="cursor-pointer rounded-2xl border border-blue-800/60 bg-blue-900/30 px-4 py-3 text-sm text-white transition hover:border-orange-400">
                        <input
                          type="radio"
                          name="registerRole"
                          value="student"
                          checked={registerRole === 'student'}
                          onChange={() => setRegisterRole('student')}
                          className="mr-2 h-4 w-4 text-orange-400"
                        />
                        Student
                      </label>
                      <label className="cursor-pointer rounded-2xl border border-blue-800/60 bg-blue-900/30 px-4 py-3 text-sm text-white transition hover:border-orange-400">
                        <input
                          type="radio"
                          name="registerRole"
                          value="startup"
                          checked={registerRole === 'startup'}
                          onChange={() => setRegisterRole('startup')}
                          className="mr-2 h-4 w-4 text-orange-400"
                        />
                        Startup / Company
                      </label>
                    </div>
                  </fieldset>

                  <div className="space-y-2">
                    <label htmlFor="registerPassword" className="block text-sm font-medium text-slate-300">Password</label>
                    <input
                      type="password"
                      id="registerPassword"
                      className="w-full rounded-2xl border border-white/10 bg-blue-900/50 px-4 py-3 text-white outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                      value={registerPassword}
                      onChange={(e) => { setRegisterPassword(e.target.value); if (registerRepeatPassword === e.target.value) setPasswordErrorVisible(false); }}
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="registerRepeatPassword" className="block text-sm font-medium text-slate-300">Repeat password</label>
                    <input
                      type="password"
                      id="registerRepeatPassword"
                      className="w-full rounded-2xl border border-white/10 bg-blue-900/50 px-4 py-3 text-white outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
                      value={registerRepeatPassword}
                      onChange={(e) => { setRegisterRepeatPassword(e.target.value); if (registerPassword === e.target.value) setPasswordErrorVisible(false); }}
                      required
                    />
                  </div>

                  {passwordErrorVisible ? (
                    <div className="rounded-2xl bg-red-500/10 border border-red-400 px-4 py-3 text-sm text-red-200">Passwords do not match</div>
                  ) : null}

                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked
                      readOnly
                      className="h-4 w-4 rounded border-blue-800/60 bg-blue-900/50 text-orange-400"
                    />
                    <span>I have read and agree to the terms.</span>
                  </div>

                  <button type="submit" className="w-full rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-400">Register</button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
