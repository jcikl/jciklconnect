// Authentication Hook
import React, { useState, useEffect, useRef, createContext, useContext, useCallback, useMemo, ReactNode } from 'react';
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
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { COLLECTIONS, DEFAULT_LO_ID } from '../config/constants';
import { Member, UserRole, MemberTier } from '../types';
import { MOCK_DEV_ADMIN } from '../services/mockData';
import { setDevMode, isDevMode as checkDevMode } from '../utils/devMode';
import { saveAuthState, loadAuthState, clearAuthState, isDevModeStored } from '../utils/authStorage';
import { MembersService } from '../services/membersService';
import { BoardManagementService } from '../services/boardManagementService';
import { errorLoggingService } from '../services/errorLoggingService';

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
  authError: string | null;
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
  const [authError, setAuthError] = useState<string | null>(null);
  // AUTH-003: client-side cooldown to prevent password-reset email flooding
  const lastResetRequestRef = useRef<number>(0);
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
      // AUTH-006 / TODO SEC-003: guard with import.meta.env.DEV so this path is compiled out of production.
    const _devEmail = import.meta.env.DEV ? (import.meta.env.VITE_DEV_EMAIL as string | undefined) : undefined;
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
    // AUTH-001: real-time role listener — unsubscribed when auth state changes or component unmounts
    let memberUnsubscribe: (() => void) | null = null;

    // Only set up listener if not in dev mode
    if (!checkDevMode()) {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        // Snapshot isSigningUpRef at entry — the ref may be reset to false by signUp()
        // BEFORE this async handler reaches its error-handling branches (race condition).
        const isMidSignUp = isSigningUpRef.current;

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
                    errorLoggingService.logError(err, { action: 'auth-cleanup-old-profile', oldId });
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
                errorLoggingService.logError(boardSyncErr, { action: 'auth-board-sync', uid: firebaseUser.uid });
              }
              // Atomic: user + member land in the same commit so no render sees user without member
              setUser(firebaseUser);
              setMember(memberData);

              // AUTH-001: Subscribe to real-time role changes so demotions/promotions take
              // effect within seconds instead of waiting up to 60 min for a token refresh.
              if (memberUnsubscribe) memberUnsubscribe();
              memberUnsubscribe = onSnapshot(
                doc(db, COLLECTIONS.MEMBERS, firebaseUser.uid),
                (snap) => {
                  if (!isMounted || checkDevMode()) return;
                  if (snap.exists()) {
                    setMember({ id: firebaseUser.uid, ...snap.data() } as Member);
                  }
                },
                (err) => {
                  // Suppress permission errors fired during sign-out (token already invalidated)
                  if (!auth.currentUser) return;
                  errorLoggingService.logError(err, { action: 'auth-member-snapshot', uid: firebaseUser.uid });
                }
              );
            } else if (!memberData && isMounted && !checkDevMode()) {
              // Still no member record — sign out, unless we're mid-signup (doc not written yet)
              if (!isMidSignUp) {
                // Delete orphaned Auth account (no members record = system-created by mistake)
                try {
                  await fetch('/.netlify/functions/delete-auth-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uid: firebaseUser.uid }),
                  });
                } catch { /* non-critical */ }
                await firebaseSignOut(auth);
                setUser(null);
                setMember(null);
              }
            }
          } catch (error) {
            // Only log error if not in dev mode
            if (!checkDevMode() && isMounted) {
              errorLoggingService.logError(error as Error, { action: 'useAuth-load-member-data' });
              // Don't nullify auth state if we're mid-signup — the member doc hasn't
              // been written yet so getMemberByEmail will throw a permissions error,
              // which is expected. signUp() will set user/member itself on completion.
              if (!isMidSignUp) {
                setUser(null);
                setMember(null);
                setAuthError('无法验证登录状态，请刷新页面或重新登录');
              }
            } else if (checkDevMode()) {
              // In dev mode, silently ignore Firebase errors
              console.log('[DEV MODE] Skipping member data load from Firebase');
            }
          }
        } else {
          if (isMounted && !checkDevMode()) {
            setUser(null);
            setMember(null);
            // Clean up simulated role state regardless of how sign-out was triggered (e.g., idle timeout)
            setSimulatedRole(null);
            setSimulatedMemberId(null);
            setOriginalRole(null);
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
      if (memberUnsubscribe) {
        memberUnsubscribe();
      }
    };
  }, [isDevMode]);

  // P2: Idle session timeout — sign out after 30 minutes of inactivity.
  useEffect(() => {
    const IDLE_MS = 30 * 60 * 1000; // 30 min
    let idleTimer = setTimeout(() => { if (user) firebaseSignOut(auth); }, IDLE_MS);
    const reset = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => { if (user) firebaseSignOut(auth); }, IDLE_MS); };
    window.addEventListener('mousemove', reset);
    window.addEventListener('keydown', reset);
    return () => { clearTimeout(idleTimer); window.removeEventListener('mousemove', reset); window.removeEventListener('keydown', reset); };
  }, [user]);

  const signIn = useCallback(async (email: string, password: string) => {
    // AUTH-006: Dev mock login is compiled OUT of production builds via the import.meta.env.DEV
    // guard. VITE_DEV_EMAIL / VITE_DEV_PASSWORD are still VITE_-prefixed (bundled), but because
    // this entire block is dead code in production the values are tree-shaken out.
    // TODO SEC-003: rename to DEV_EMAIL / DEV_PASSWORD (non-VITE_) for full elimination.
    const devEmail = import.meta.env.DEV ? (import.meta.env.VITE_DEV_EMAIL as string | undefined) : undefined;
    const devPassword = import.meta.env.DEV ? (import.meta.env.VITE_DEV_PASSWORD as string | undefined) : undefined;
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
      });

      return;
    }

    // Regular Firebase authentication
    let userCred;
    try {
      userCred = await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      const code = err?.code ?? '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        // Auth doesn't exist — check if this email belongs to a member
        try {
          const res = await fetch('/.netlify/functions/check-and-create-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });
          const data = await res.json();
          if (data.isMember && data.created) {
            // Auth just created — send password reset so member can set their password
            const { sendPasswordResetEmail } = await import('firebase/auth');
            await sendPasswordResetEmail(auth, email);
            throw new Error('密码重置邮件已发送至您的邮箱，请查收后设置密码再登录');
          }
          if (data.isMember && data.authExists) {
            throw new Error('密码错误，请重试或点击"忘记密码"重置');
          }
        } catch (inner: any) {
          if (inner.message && !inner.message.includes('check-and-create')) throw inner;
        }
        throw new Error('账号不存在，请先注册');
      }
      throw err;
    }

    // Login succeeded — check if member record exists
    const memberDoc = await getDoc(doc(db, COLLECTIONS.MEMBERS, userCred.user.uid));
    if (!memberDoc.exists()) {
      const existingProfile = await MembersService.getMemberByEmail(email);
      if (!existingProfile) {
        // Orphaned Auth account (no members record) — delete and kick out
        try {
          await fetch('/.netlify/functions/delete-auth-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: userCred.user.uid }),
          });
        } catch { /* non-critical */ }
        await firebaseSignOut(auth);
        throw new Error('账号不存在，请先注册');
      }
      // Note: Linking is handled by onAuthStateChanged listener
    }
  }, [isDevMode]);

  const signUp = useCallback(async (email: string, password: string, name: string, additionalData?: Record<string, any>) => {
    // Check if in developer mode
    // P0: Guard with import.meta.env.DEV so the dev-email comparison is compiled out of production.
    const _devEmailForSignUp = import.meta.env.DEV ? (import.meta.env.VITE_DEV_EMAIL as string | undefined) : undefined;
    if (checkDevMode() || (import.meta.env.DEV && _devEmailForSignUp && email === _devEmailForSignUp)) {
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
      });

      return;
    }

    // 1. Check if an imported profile already exists with this email
    let existingProfile: Member | null = null;
    try {
      const { MembersService } = await import('../services/membersService');
      existingProfile = await MembersService.getMemberByEmail(email);
    } catch (e) {
      errorLoggingService.logError(e, { action: 'signup-check-existing-profile', email });
    }

    // 2. Create Firebase Auth user — set flag so onAuthStateChanged doesn't sign out
    //    before the member document is written (race condition)
    isSigningUpRef.current = true;
    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') {
        // Orphaned Auth account (no members record verified by earlier check) — delete and retry
        try {
          await fetch('/.netlify/functions/delete-auth-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });
          userCredential = await createUserWithEmailAndPassword(auth, email, password);
        } catch (retryErr) {
          isSigningUpRef.current = false;
          throw retryErr;
        }
      } else {
        isSigningUpRef.current = false;
        throw err;
      }
    }
    await updateProfile(userCredential!.user, { displayName: name });

    // 3. Create or Update member document
    // Self-registrations (no pre-imported profile) start as GUEST pending admin review
    const isNewSelfRegistration = !existingProfile;
    const newMember: Partial<Member> = {
      name,
      email,
      role: existingProfile?.role || UserRole.GUEST,
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
    if (!cleanMember.loId) cleanMember.loId = DEFAULT_LO_ID;

    // Save to the new UID (this links the Firebase Auth user to the profile data)
    await setDoc(doc(db, COLLECTIONS.MEMBERS, userCredential!.user.uid), cleanMember);

    // pendingRegistrations write removed — GuestManagementView queries PROBATION members directly.

    // If we matched an existing profile that had a different ID (imported random ID),
    // we might want to delete the old document to avoid duplicates.
    if (existingProfile && existingProfile.id !== userCredential!.user.uid) {
      try {
        const { deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, COLLECTIONS.MEMBERS, existingProfile.id));
      } catch (e) {
        errorLoggingService.logError(e, { action: 'signup-cleanup-old-imported-profile', oldId: existingProfile.id });
      }
    }

    // Update local state — reset the sign-up guard AFTER state is committed so
    // onAuthStateChanged never sees isSigningUpRef=false with member still null.
    setUser(userCredential!.user);
    setMember({ id: userCredential!.user.uid, ...newMember } as Member);
    isSigningUpRef.current = false;
  }, [isDevMode]);

  const signInWithGoogle = useCallback(async () => {
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
        // Orphaned Auth account (no members record) — delete and kick out
        try {
          await fetch('/.netlify/functions/delete-auth-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: userCredential.user.uid }),
          });
        } catch { /* non-critical */ }
        await firebaseSignOut(auth);
        throw new Error('账号不存在，请先注册');
      }
      // Note: Linking to UID is handled automatically by the onAuthStateChanged listener above
    }
  }, []);

  const signOut = useCallback(async () => {
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
  }, [isDevMode]);

  const resetPassword = useCallback(async (email: string) => {
    // AUTH-003: 60-second client-side cooldown to prevent inbox-flooding abuse.
    // P2: Use sessionStorage instead of useRef so the cooldown survives page refreshes.
    const COOLDOWN_MS = 60_000;
    const now = Date.now();
    const ssKey = 'pw_reset_' + email;
    const lastRequest = parseInt(sessionStorage.getItem(ssKey) || '0');
    const elapsed = now - lastRequest;
    if (elapsed < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      throw new Error(`请等待 ${remaining} 秒后再重新发送重置邮件。`);
    }
    sessionStorage.setItem(ssKey, String(now));
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      const code: string = err?.code ?? '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-email' || err?.status === 400) {
        // Firebase Auth account doesn't exist. Silently try auto-invite: if this email
        // belongs to a Firestore member, the function creates the Auth account and sends
        // a password-setup email. Always show the same neutral message either way.
        try {
          await fetch('/.netlify/functions/auto-invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });
        } catch {
          // Network failure — swallow silently, neutral message shown below
        }
        throw new Error('If an account exists for this email, a reset link has been sent. Please check your inbox (and spam folder).');
      }
      if (code === 'auth/too-many-requests') {
        throw new Error('Too many requests. Please wait a few minutes and try again.');
      }
      throw new Error('Failed to send reset email. Please try again or contact your administrator.');
    }
  }, []);

  const updateMemberProfile = useCallback(async (updates: Partial<Member>) => {
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
  }, [user, member, isDevMode]);

  const simulateRole = useCallback((role: UserRole | null) => {
    if (!member) return;

    let currentOriginal = originalRole;
    if (!currentOriginal) {
      currentOriginal = (member.role as UserRole) || UserRole.ADMIN;
      setOriginalRole(currentOriginal);
    }

    // Only allow if in dev mode OR original role is ADMIN / SUPER_ADMIN
    if (!isDevMode && currentOriginal !== UserRole.ADMIN && currentOriginal !== UserRole.SUPER_ADMIN) {
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
      // B-4: also patch membershipType to match simulated role (Guest→'Guest', else keep current)
      const membershipTypePatch = role === UserRole.GUEST ? { membershipType: 'Guest' as const } : {};
      // If simulating as a specific member, restore original member first then apply new role
      if (simulatedMemberId) {
        setSimulatedMemberId(null);
        const base = originalMember || member;
        setMember({ ...base, role, ...membershipTypePatch });
        setOriginalMember(null);
      } else {
        setMember({ ...member, role, ...membershipTypePatch });
      }
    }
  }, [member, originalMember, originalRole, simulatedMemberId, isDevMode]);

  const simulateAsMember = useCallback(async (memberId: string, _roleHint: UserRole) => {
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

    // B-5: use the target member's actual role rather than the label-color-derived hint
    const effectiveRole = (targetMember.role as UserRole) || _roleHint;
    setSimulatedMemberId(memberId);
    setSimulatedRole(effectiveRole);
    setMember({ ...targetMember, role: effectiveRole });
  }, [member, originalMember, originalRole, isDevMode]);

  const contextValue = useMemo(() => ({
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
    authError,
  }), [
    user, member, loading, isDevMode, simulatedRole, simulatedMemberId, authError,
    signIn, signUp, signInWithGoogle, signOut, resetPassword, updateMemberProfile, simulateRole, simulateAsMember,
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
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

