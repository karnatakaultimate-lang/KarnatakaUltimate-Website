import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebaseClient';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { supabase } from '../supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Keep avatar_url in sync with Google photo on every login
        if (currentUser.photoURL) {
          await supabase.from('profiles')
            .update({ avatar_url: currentUser.photoURL })
            .eq('id', currentUser.uid);
        }
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.uid)
          .single();
        setProfile(data || null);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Refresh profile after edits
  const refreshProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.uid)
      .single();
    setProfile(data || null);
  };

  const value = {
    user,
    profile,
    isAdmin: profile?.is_admin === true,
    refreshProfile,
    signOut: () => firebaseSignOut(auth),
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
