import React, { useEffect, useState } from 'react';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase.js';

export default function Profile({ user }) {
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-900 via-blue-950 to-black text-white">
        <div className="max-w-xl rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-8 text-center">
          <p className="text-lg">You must be logged in to view your profile.</p>
        </div>
      </div>
    );
  }

  const [currentRole, setCurrentRole] = useState(user.role || '');
  const [updatingRole, setUpdatingRole] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    setCurrentRole(user.role || '');
  }, [user.role]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (user?.uid) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data());
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    };
    fetchUserData();
  }, [user?.uid]);

  const displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
  const email = user.email || '—';
  const role = currentRole || '—';

  const handleRoleSelect = async (selectedRole) => {
    setUpdatingRole(true);
    setMessageType('info');
    setMessage('Saving account type...');

    const activeUser = auth.currentUser || user;
    if (!activeUser?.uid) {
      console.error('No authenticated user available for role save:', activeUser);
      setMessageType('error');
      setMessage('Unable to save account type right now. Please sign out and sign back in.');
      setUpdatingRole(false);
      return;
    }

    try {
      const userRef = doc(db, 'users', activeUser.uid);
      await setDoc(
        userRef,
        {
          uid: activeUser.uid,
          email: activeUser.email || user.email || '',
          displayName,
          role: selectedRole,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      const savedUser = {
        ...user,
        uid: activeUser.uid,
        email: activeUser.email || user.email,
        displayName,
        role: selectedRole
      };
      localStorage.setItem('user', JSON.stringify(savedUser));
      setCurrentRole(selectedRole);
      setMessageType('success');
      setMessage('Account type saved successfully. Refresh or navigate to your dashboard.');
    } catch (error) {
      console.error('Error saving role:', error);
      setMessageType('error');
      setMessage('Could not save account type. Please try again.');
    } finally {
      setUpdatingRole(false);
      window.setTimeout(() => setMessage(''), 5000);
    }
  };

  const missingRole = !['student', 'startup'].includes(currentRole);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 via-blue-950 to-black text-white pt-28 sm:pt-24 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl rounded-[1.5rem] border border-white/10 bg-white/5 backdrop-blur-sm p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="h-16 w-16 sm:h-20 sm:w-20 flex-none overflow-hidden rounded-2xl bg-blue-900/60 border border-blue-800/60 flex items-center justify-center text-2xl sm:text-3xl text-orange-400">
            {user.photoURL ? (
              <img src={user.photoURL} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="font-bold">{(displayName || 'U')[0].toUpperCase()}</span>
            )}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">{displayName}</h1>
            <p className="mt-1 text-sm text-slate-300">{email}</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-blue-800/60 bg-blue-900/30 p-4 text-center">
            <div className="text-sm text-slate-300">Account Type</div>
            <div className="mt-2 text-base sm:text-lg font-semibold text-white capitalize">{role}</div>
          </div>
          <div className="rounded-2xl border border-blue-800/60 bg-blue-900/30 p-4 text-center">
            <div className="text-sm text-slate-300">User ID</div>
            <div className="mt-2 text-xs text-slate-300 break-all">{user.uid || '—'}</div>
          </div>
          <div className="rounded-2xl border border-blue-800/60 bg-blue-900/30 p-4 text-center">
            <div className="text-sm text-slate-300">Email Verified</div>
            <div className="mt-2 text-base sm:text-lg font-semibold text-white">{user.emailVerified ? 'Yes' : 'No'}</div>
          </div>
          <div className="rounded-2xl border border-blue-800/60 bg-blue-900/30 p-4 text-center">
            <div className="text-sm text-slate-300">Account Created</div>
            <div className="mt-2 text-base sm:text-lg font-semibold text-white">{userData?.createdAt ? new Date(userData.createdAt.seconds * 1000).toLocaleDateString() : '—'}</div>
          </div>
          <div className="rounded-2xl border border-blue-800/60 bg-blue-900/30 p-4 text-center">
            <div className="text-sm text-slate-300">Display Name</div>
            <div className="mt-2 text-base sm:text-lg font-semibold text-white">{userData?.displayName || '—'}</div>
          </div>
          <div className="rounded-2xl border border-blue-800/60 bg-blue-900/30 p-4 text-center">
            <div className="text-sm text-slate-300">Email</div>
            <div className="mt-2 text-xs sm:text-sm font-semibold text-white break-all">{userData?.email || '—'}</div>
          </div>
        </div>

        {missingRole ? (
          <div className="mt-8 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4 sm:p-6 text-sm text-orange-100">
            <p className="font-semibold">Your account is missing role data.</p>
            <p className="mt-2 text-slate-300">Please choose the correct account type so the app can send you to the right dashboard.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => handleRoleSelect('student')}
                disabled={updatingRole}
                className="rounded-2xl bg-blue-900/60 border border-blue-800/60 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-70"
              >
                Student Account
              </button>
              <button
                type="button"
                onClick={() => handleRoleSelect('startup')}
                disabled={updatingRole}
                className="rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-400 disabled:opacity-70"
              >
                Company Account
              </button>
            </div>
            {message ? (
              <p className={`mt-3 text-sm ${messageType === 'success' ? 'text-emerald-300' : messageType === 'error' ? 'text-rose-300' : 'text-slate-200'}`}>
                {message}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-8 text-sm text-slate-300">
            <p>If you need to update your information, please visit account settings or contact support.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// `user` is provided by App via onAuthStateChanged and localStorage
