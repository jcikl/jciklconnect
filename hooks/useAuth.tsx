// Authentication Hook
import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { Member, UserRole, MemberTier } from '../types';
import { MOCK_DEV_ADMIN } from '../services/mockData';
import { setDevMode, isDevMode as checkDevMode } from '../utils/devMode';
import { saveAuthState, loadAuthState, clearAuthState, isDevModeStored } from '../utils/authStorage';
import { MembersService } from '../services/membersService';

interface AuthContextType {
  user: User | null;
  member: Member | null;
  loading: boolean;
  isDevMode: boolean;
  simulatedRole: UserRole | null; // Role being simulated in dev mode
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, additionalData?: Record<string, any>) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateMemberProfile: (updates: Partial<Member>) => Promise<void>;
  simulateRole: (role: UserRole | null) => void; // Role simulator function
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDevMode, setIsDevMode] = useState(false);
  const [simulatedRole, setSimulatedRole] = useState<UserRole | null>(null);

  // Load persisted auth state on mount (runs first, before Firebase listener)
  useEffect(() => {
    const storedState = loadAuthState();

    if (storedState && storedState.isDevMode) {
      // Restore dev mode state from localStorage
      setIsDevMode(true);
      setDevMode(true);

      // Restore mock user
      const mockUser = {
        uid: storedState.user.uid,
        email: storedState.user.email,
        displayName: storedState.user.displayName,
        emailVerified: true,
        isAnonymous: false,
        metadata: {},
        providerData: [],
        refreshToken: '',
        tenantId: null,
        delete: async () => { },
        getIdToken: async () => '',
        getIdTokenResult: async () => ({} as any),
        reload: async () => { },
        toJSON: () => ({}),
        phoneNumber: null,
        photoURL: null,
        providerId: 'password',
      } as User;

      setUser(mockUser);
      // Use full MOCK_DEV_ADMIN when restoring admin@jcikl.com session
      const member = storedState.user.email === 'admin@jcikl.com' ? MOCK_DEV_ADMIN : (storedState.member as Member);
      setMember(member);
      setLoading(false);
      // Early return - don't set up Firebase listener
      return;
    }
    // If no stored state, let Firebase listener handle authentication
  }, []);

  useEffect(() => {
    // Skip Firebase auth listener if in dev mode (check both state and global)
    if (isDevMode || checkDevMode()) {
      // Only set loading to false if we haven't already set user/member
      if (!user && !member) {
        setLoading(false);
      }
      return () => { }; // Return empty cleanup function
    }

    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    // Only set up listener if not in dev mode
    if (!checkDevMode()) {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        // Check dev mode state at the time of execution using global function
        if (!isMounted || checkDevMode()) {
          if (isMounted) {
            setLoading(false);
          }
          return;
        }

        setUser(firebaseUser);

        if (firebaseUser && !checkDevMode()) {
          // Load member data from Firestore — must exist or user is not allowed to stay logged in
          try {
            // 1. Try UID lookup first
            const memberDoc = await getDoc(doc(db, COLLECTIONS.MEMBERS, firebaseUser.uid));
            let memberData: Member | null = null;

            if (memberDoc.exists()) {
              memberData = { id: firebaseUser.uid, ...memberDoc.data() } as Member;
            } else if (firebaseUser.email) {
              // 2. Try Email lookup if UID failed (for newly linked accounts or imported members)
              const existingProfile = await MembersService.getMemberByEmail(firebaseUser.email);

              if (existingProfile) {
                // Link the profile to the new UID
                const { id: oldId, ...data } = existingProfile;
                const newMemberData = { ...data, updatedAt: new Date().toISOString() };

                // Copy to new ID (UID)
                await setDoc(doc(db, COLLECTIONS.MEMBERS, firebaseUser.uid), newMemberData);

                // If the old record had a different ID (imported ID), clean it up
                if (oldId !== firebaseUser.uid) {
                  try {
                    const { deleteDoc } = await import('firebase/firestore');
                    await deleteDoc(doc(db, COLLECTIONS.MEMBERS, oldId));
                  } catch (err) {
                    console.error('Failed to cleanup old profile:', err);
                  }
                }

                memberData = { id: firebaseUser.uid, ...newMemberData } as Member;
              }
            }

            if (memberData && isMounted && !checkDevMode()) {
              setMember(memberData);
            } else if (!memberData && isMounted && !checkDevMode()) {
              // Still no member record for this account — sign out so they cannot use the app
              await firebaseSignOut(auth);
              setUser(null);
              setMember(null);
            }
          } catch (error) {
            // Only log error if not in dev mode
            if (!checkDevMode() && isMounted) {
              console.error('Error loading member data:', error);
            } else if (checkDevMode()) {
              // In dev mode, silently ignore Firebase errors
              console.log('[DEV MODE] Skipping member data load from Firebase');
            }
          }
        } else {
          if (isMounted && !checkDevMode()) {
            setMember(null);
          }
        }

        if (isMounted && !checkDevMode()) {
          setLoading(false);
        }
      });
    }

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isDevMode]);

  const signIn = async (email: string, password: string) => {
    // Developer mock login
    if (email === 'admin@jcikl.com' && password === 'admin123') {
      setIsDevMode(true);
      setDevMode(true);

      // Create mock user object
      const mockUser = {
        uid: 'dev-admin-001',
        email: 'admin@jcikl.com',
        displayName: 'Admin User',
        emailVerified: true,
        isAnonymous: false,
        metadata: {},
        providerData: [],
        refreshToken: '',
        tenantId: null,
        delete: async () => { },
        getIdToken: async () => '',
        getIdTokenResult: async () => ({} as any),
        reload: async () => { },
        toJSON: () => ({}),
        phoneNumber: null,
        photoURL: null,
        providerId: 'password',
      } as User;

      setUser(mockUser);
      setMember(MOCK_DEV_ADMIN);
      setLoading(false);

      // Save to localStorage for persistence
      saveAuthState({
        isDevMode: true,
        user: {
          uid: mockUser.uid,
          email: mockUser.email || '',
          displayName: mockUser.displayName || '',
        },
        member: MOCK_DEV_ADMIN,
      });

      return;
    }

    // Regular Firebase authentication
    const userCred = await signInWithEmailAndPassword(auth, email, password);

    // Check if member exists by UID or email
    const memberDoc = await getDoc(doc(db, COLLECTIONS.MEMBERS, userCred.user.uid));
    if (!memberDoc.exists()) {
      const existingProfile = await MembersService.getMemberByEmail(email);
      if (!existingProfile) {
        await firebaseSignOut(auth);
        throw new Error('此帳號在會員名單中不存在，無法登入。請聯絡管理員。');
      }
      // Note: Linking is handled by onAuthStateChanged listener
    }
  };

  const signUp = async (email: string, password: string, name: string, additionalData?: Record<string, any>) => {
    // Check if in developer mode
    if (checkDevMode() || email === 'admin@jcikl.com') {
      // In developer mode, simulate sign up
      const mockUser = {
        uid: `mock-user-${Date.now()}`,
        email,
        displayName: name,
        emailVerified: true,
        isAnonymous: false,
        metadata: {},
        providerData: [],
        refreshToken: '',
        tenantId: null,
        delete: async () => { },
        getIdToken: async () => '',
        getIdTokenResult: async () => ({} as any),
        reload: async () => { },
        toJSON: () => ({}),
        phoneNumber: null,
        photoURL: null,
        providerId: 'password',
      } as User;

      const mockMember: Member = {
        id: mockUser.uid,
        name,
        email,
        role: UserRole.GUEST,
        tier: 'Bronze' as any,
        points: 0,
        joinDate: new Date().toISOString().split('T')[0],
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0097D7&color=fff`,
        skills: additionalData?.skills || [],
        hobbies: Array.isArray(additionalData?.hobbies) ? additionalData.hobbies : [],
        churnRisk: 'Low',
        attendanceRate: 100,
        duesStatus: 'Pending',
        badges: [],
        phone: additionalData?.phone,
        bio: additionalData?.bio,
        fullName: additionalData?.fullName,
        gender: additionalData?.gender,
        dateOfBirth: additionalData?.dateOfBirth,
        nationality: additionalData?.nationality || 'Malaysia',
      };

      setUser(mockUser);
      setMember(mockMember);

      // Save to localStorage for persistence
      saveAuthState({
        isDevMode: true,
        user: {
          uid: mockUser.uid,
          email: mockUser.email,
          displayName: mockUser.displayName || name,
        },
        member: mockMember,
      });

      return;
    }

    // 1. Check if an imported profile already exists with this email
    let existingProfile: Member | null = null;
    try {
      const { MembersService } = await import('../services/membersService');
      existingProfile = await MembersService.getMemberByEmail(email);
    } catch (e) {
      console.warn('Could not check for existing profile during signup:', e);
    }

    // 2. Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: name });

    // 3. Create or Update member document
    const newMember: Partial<Member> = {
      name,
      email,
      role: existingProfile?.role || UserRole.GUEST,
      tier: existingProfile?.tier || ('Bronze' as any),
      points: existingProfile?.points || 0,
      joinDate: existingProfile?.joinDate || new Date().toISOString().split('T')[0],
      avatar: existingProfile?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0097D7&color=fff`,
      skills: existingProfile?.skills || additionalData?.skills || [],
      hobbies: existingProfile?.hobbies || (Array.isArray(additionalData?.hobbies) ? additionalData.hobbies : []),
      churnRisk: existingProfile?.churnRisk || 'Low',
      attendanceRate: existingProfile?.attendanceRate || 100,
      duesStatus: existingProfile?.duesStatus || 'Pending',
      badges: existingProfile?.badges || [],
      phone: existingProfile?.phone || additionalData?.phone,
      bio: existingProfile?.bio || additionalData?.bio,
      fullName: existingProfile?.fullName || additionalData?.fullName,
      gender: existingProfile?.gender || additionalData?.gender,
      dateOfBirth: existingProfile?.dateOfBirth || additionalData?.dateOfBirth,
      nationality: existingProfile?.nationality || additionalData?.nationality || 'Malaysia',
      // Carry over any other imported data if matched
      ...(existingProfile || {})
    };

    // Save to the new UID (this links the Firebase Auth user to the profile data)
    await setDoc(doc(db, COLLECTIONS.MEMBERS, userCredential.user.uid), newMember);

    // If we matched an existing profile that had a different ID (imported random ID), 
    // we might want to delete the old document to avoid duplicates.
    if (existingProfile && existingProfile.id !== userCredential.user.uid) {
      try {
        const { deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, COLLECTIONS.MEMBERS, existingProfile.id));
      } catch (e) {
        console.error('Failed to cleanup old imported profile:', e);
      }
    }

    // Update local state
    setUser(userCredential.user);
    setMember({ id: userCredential.user.uid, ...newMember } as Member);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const email = userCredential.user.email;

    if (!email) {
      await firebaseSignOut(auth);
      throw new Error('無法获取 Google 帳號的电邮地址。');
    }

    // Require member document to exist (by UID or Email) — no auto-create; must be in member list to log in
    const memberDoc = await getDoc(doc(db, COLLECTIONS.MEMBERS, userCredential.user.uid));
    if (!memberDoc.exists()) {
      const existingProfile = await MembersService.getMemberByEmail(email);
      if (!existingProfile) {
        await firebaseSignOut(auth);
        throw new Error('此帳號在會員名單中不存在，無法登入。請聯絡管理员。');
      }
      // Note: Linking to UID is handled automatically by the onAuthStateChanged listener above
    }
  };

  const signOut = async () => {
    if (isDevMode) {
      setIsDevMode(false);
      setDevMode(false);
      setUser(null);
      setMember(null);
      // Clear localStorage
      clearAuthState();
      return;
    }
    await firebaseSignOut(auth);
    // Clear any stored state (though Firebase handles this)
    clearAuthState();
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const updateMemberProfile = async (updates: Partial<Member>) => {
    if (!user) throw new Error('User not authenticated');

    // In dev mode, just update local state
    if (isDevMode) {
      if (member) {
        const updatedMember = { ...member, ...updates };
        setMember(updatedMember);

        // Update localStorage
        saveAuthState({
          isDevMode: true,
          user: {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || '',
          },
          member: updatedMember,
        });
      }
      return;
    }

    await setDoc(
      doc(db, COLLECTIONS.MEMBERS, user.uid),
      { ...updates, updatedAt: new Date().toISOString() },
      { merge: true }
    );

    if (member) {
      setMember({ ...member, ...updates });
    }
  };

  const simulateRole = (role: UserRole | null) => {
    if (!isDevMode || !member) return;

    setSimulatedRole(role);

    // Update member with simulated role
    if (role) {
      setMember({
        ...member,
        role: role,
      });
    } else {
      // Reset to original admin role
      setMember({
        ...member,
        role: UserRole.ADMIN,
      });
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      member,
      loading,
      isDevMode,
      simulatedRole,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      resetPassword,
      updateMemberProfile,
      simulateRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

