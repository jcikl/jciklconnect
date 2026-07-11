// Authentication Hook
import React, { useState, useEffect, useRef, createContext, useContext, ReactNode } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { Member, UserRole, MemberTier } from '../types';
import { MOCK_DEV_ADMIN } from '../services/mockData';
import { setDevMode, isDevMode as checkDevMode } from '../utils/devMode';
import { saveAuthState, loadAuthState, clearAuthState, isDevModeStored } from '../utils/authStorage';
import { MembersService } from '../services/membersService';
import { BoardManagementService } from '../services/boardManagementService';
import { CommunicationService } from '../services/communicationService';

interface AuthContextType {
  user: User | null;
  member: Member | null;
  loading: boolean;
  isDevMode: boolean;
  simulatedRole: UserRole | null;
  simulatedMemberId: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, additionalData?: Record<string, any>) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateMemberProfile: (updates: Partial<Member>) => Promise<void>;
  simulateRole: (role: UserRole | null) => void;
  simulateAsMember: (memberId: string, role: UserRole) => Promise<void>;
}

// Persist context reference across Vite HMR reloads to avoid "must be used within provider" errors
const _w = window as any;
const AuthContext: React.Context<AuthContextType | undefined> =
  _w.__jcikl_auth_ctx__ ?? (_w.__jcikl_auth_ctx__ = createContext<AuthContextType | undefined>(undefined));

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDevMode, setIsDevMode] = useState(false);
  const [simulatedRole, setSimulatedRole] = useState<UserRole | null>(null);
  const [simulatedMemberId, setSimulatedMemberId] = useState<string | null>(null);
  const [originalMember, setOriginalMember] = useState<Member | null>(null);
  const [originalRole, setOriginalRole] = useState<UserRole | null>(null);
  // Prevents onAuthStateChanged from signing out a user whose member doc hasn't been written yet
  const isSigningUpRef = useRef(false);

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
      const _devEmail = import.meta.env.VITE_DEV_EMAIL as string | undefined;
      const member = (_devEmail && storedState.user.email === _devEmail) ? MOCK_DEV_ADMIN : (storedState.member as Member);
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

        if (firebaseUser && !checkDevMode()) {
          // Load member data from Firestore — must exist or user is not allowed to stay logged in.
          // NOTE: setUser is deferred until member data resolves — setting user with member still
          // null lets authenticated views render against a null member and crash (ErrorBoundary
          // on first Google login in the APK).
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
              try {
                const boardSync = await BoardManagementService.ensureMemberBoardFieldsSynced(memberData);
                if (boardSync) {
                  memberData = { ...memberData, ...boardSync };
                }
              } catch (boardSyncErr) {
                console.warn('Board membership sync skipped:', boardSyncErr);
              }
              // Atomic: user + member land in the same commit so no render sees user without member
              setUser(firebaseUser);
              setMember(memberData);
            } else if (!memberData && isMounted && !checkDevMode()) {
              // Still no member record — sign out, unless we're mid-signup (doc not written yet)
              if (!isSigningUpRef.current) {
                await firebaseSignOut(auth);
                setUser(null);
                setMember(null);
              }
            }
          } catch (error) {
            // Only log error if not in dev mode
            if (!checkDevMode() && isMounted) {
              console.error('Error loading member data:', error);
              // Keep the UI logged-out rather than half-authenticated; session persists for retry
              setUser(null);
              setMember(null);
            } else if (checkDevMode()) {
              // In dev mode, silently ignore Firebase errors
              console.log('[DEV MODE] Skipping member data load from Firebase');
            }
          }
        } else {
          if (isMounted && !checkDevMode()) {
            setUser(null);
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
    // Developer mock login — credentials set via VITE_DEV_EMAIL / VITE_DEV_PASSWORD env vars
    const devEmail = import.meta.env.VITE_DEV_EMAIL as string | undefined;
    const devPassword = import.meta.env.VITE_DEV_PASSWORD as string | undefined;
    if (devEmail && devPassword && email === devEmail && password === devPassword) {
      setIsDevMode(true);
      setDevMode(true);

      // Create mock user object
      const mockUser = {
        uid: 'dev-admin-001',
        email: devEmail,
        displayName: 'Dev Admin',
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
        throw new Error('This account does not exist in the member list. Please contact the administrator.');
      }
      // Note: Linking is handled by onAuthStateChanged listener
    }
  };

  const signUp = async (email: string, password: string, name: string, additionalData?: Record<string, any>) => {
    // Check if in developer mode
    const _devEmailForSignUp = import.meta.env.VITE_DEV_EMAIL as string | undefined;
    if (checkDevMode() || (_devEmailForSignUp && email === _devEmailForSignUp)) {
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
        role: UserRole.SUPER_ADMIN,
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

    // 2. Create Firebase Auth user — set flag so onAuthStateChanged doesn't sign out
    //    before the member document is written (race condition)
    isSigningUpRef.current = true;
    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      isSigningUpRef.current = false;
      throw err;
    }
    await updateProfile(userCredential!.user, { displayName: name });

    // 3. Create or Update member document
    // Self-registrations (no pre-imported profile) start at PROBATION pending admin review
    const isNewSelfRegistration = !existingProfile;
    const newMember: Partial<Member> = {
      name,
      email,
      role: existingProfile?.role || UserRole.PROBATION,
      tier: existingProfile?.tier || ('Bronze' as any),
      points: existingProfile?.points || 0,
      joinDate: existingProfile?.joinDate || new Date().toISOString().split('T')[0],
      avatar: existingProfile?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0097D7&color=fff`,
      skills: existingProfile?.skills || additionalData?.skills || [],
      hobbies: existingProfile?.hobbies || (Array.isArray(additionalData?.selectedHobbies) ? additionalData.selectedHobbies : (Array.isArray(additionalData?.hobbies) ? additionalData.hobbies : [])),
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
      // Persona & survey data from registration form
      ...(additionalData?.surveyAnswers ? { surveyAnswers: additionalData.surveyAnswers } : {}),
      ...(additionalData?.personaType ? { personaType: additionalData.personaType } : {}),
      ...(additionalData?.tendencyTags ? { tendencyTags: additionalData.tendencyTags } : {}),
      // Carry over any other imported data if matched
      ...(existingProfile || {})
    };

    // Strip undefined fields — Firestore rejects them
    const cleanMember = Object.fromEntries(
      Object.entries(newMember).filter(([, v]) => v !== undefined)
    );

    // Save to the new UID (this links the Firebase Auth user to the profile data)
    await setDoc(doc(db, COLLECTIONS.MEMBERS, userCredential!.user.uid), cleanMember);
    isSigningUpRef.current = false;

    // 4. Notify admins & board members about the new self-registration
    if (isNewSelfRegistration) {
      try {
        const adminRoles = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.BOARD];
        const membersColl = collection(db, COLLECTIONS.MEMBERS);
        const adminSnap = await getDocs(
          query(membersColl, where('role', 'in', adminRoles))
        );
        const notifyAll = adminSnap.docs.map(d =>
          CommunicationService.createNotification({
            memberId: d.id,
            title: 'New Member Registration — Pending Review',
            message: `${additionalData?.fullName || name} (${email}) has submitted a membership application and is awaiting approval.`,
            type: 'info',
          }).catch(() => { /* don't block signup on notification failure */ })
        );
        await Promise.allSettled(notifyAll);
      } catch {
        // Notification failure must not break the registration flow
      }
    }

    // If we matched an existing profile that had a different ID (imported random ID),
    // we might want to delete the old document to avoid duplicates.
    if (existingProfile && existingProfile.id !== userCredential!.user.uid) {
      try {
        const { deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, COLLECTIONS.MEMBERS, existingProfile.id));
      } catch (e) {
        console.error('Failed to cleanup old imported profile:', e);
      }
    }

    // Update local state
    setUser(userCredential!.user);
    setMember({ id: userCredential!.user.uid, ...newMember } as Member);
  };

  const signInWithGoogle = async () => {
    let userCredential;
    if (Capacitor.isNativePlatform()) {
      // WebView 内 Google 禁止 OAuth 弹窗（disallowed_useragent），改走原生登录换取 idToken
      const result = await FirebaseAuthentication.signInWithGoogle();
      const idToken = result.credential?.idToken;
      if (!idToken) {
        throw new Error('Google sign-in failed: no credential received. Please try again.');
      }
      const credential = GoogleAuthProvider.credential(idToken, result.credential?.accessToken);
      userCredential = await signInWithCredential(auth, credential);
    } else {
      const provider = new GoogleAuthProvider();
      userCredential = await signInWithPopup(auth, provider);
    }
    const email = userCredential.user.email;

    if (!email) {
      await firebaseSignOut(auth);
      throw new Error('Unable to retrieve email address from Google account.');
    }

    // Require member document to exist (by UID or Email) — no auto-create; must be in member list to log in
    const memberDoc = await getDoc(doc(db, COLLECTIONS.MEMBERS, userCredential.user.uid));
    if (!memberDoc.exists()) {
      const existingProfile = await MembersService.getMemberByEmail(email);
      if (!existingProfile) {
        await firebaseSignOut(auth);
        throw new Error('This account does not exist in the member list. Please contact the administrator.');
      }
      // Note: Linking to UID is handled automatically by the onAuthStateChanged listener above
    }
  };

  const signOut = async () => {
    setSimulatedRole(null);
    setOriginalRole(null);
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
    if (!member) return;

    let currentOriginal = originalRole;
    if (!currentOriginal) {
      currentOriginal = (member.role as UserRole) || UserRole.ADMIN;
      setOriginalRole(currentOriginal);
    }

    // Only allow if in dev mode OR original role is ADMIN
    if (!isDevMode && currentOriginal !== UserRole.ADMIN) {
      return;
    }

    if (role === null) {
      // Reset — restore original member if we were simulating as someone else
      setSimulatedRole(null);
      setSimulatedMemberId(null);
      if (originalMember) {
        setMember(originalMember);
        setOriginalMember(null);
      } else {
        setMember({ ...member, role: currentOriginal });
      }
      setOriginalRole(null);
    } else {
      setSimulatedRole(role);
      // If simulating as a specific member, restore original member first then apply new role
      if (simulatedMemberId) {
        setSimulatedMemberId(null);
        const base = originalMember || member;
        setMember({ ...base, role });
        setOriginalMember(null);
      } else {
        setMember({ ...member, role });
      }
    }
  };

  const simulateAsMember = async (memberId: string, role: UserRole) => {
    if (!member) return;

    // Only allow if in dev mode OR current role is ADMIN
    const currentRole = originalRole || (member.role as UserRole);
    if (!isDevMode && currentRole !== UserRole.ADMIN) return;

    // Save original member before first impersonation
    if (!originalMember) {
      setOriginalMember(member);
      setOriginalRole(currentRole);
    }

    const targetMember = await MembersService.getMemberById(memberId);
    if (!targetMember) return;

    setSimulatedMemberId(memberId);
    setSimulatedRole(role);
    setMember({ ...targetMember, role });
  };

  return (
    <AuthContext.Provider value={{
      user,
      member,
      loading,
      isDevMode,
      simulatedRole,
      simulatedMemberId,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      resetPassword,
      updateMemberProfile,
      simulateRole,
      simulateAsMember,
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

