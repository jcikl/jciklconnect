// Login Modal Component
import React, { useState } from 'react';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { Modal, Button, useToast } from '../ui/Common';
import { Input } from '../ui/Form';
import { useAuth } from '../../hooks/useAuth';
import { fetchSignInMethodsForEmail } from 'firebase/auth';
import { auth } from '../../config/firebase';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToRegister?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onSwitchToRegister
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const { signIn, signInWithGoogle, resetPassword } = useAuth();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signIn(email, password);
      showToast('Login successful!', 'success');
      onClose();
      setEmail('');
      setPassword('');
    } catch (err: any) {
      let errorMessage = err?.message || 'Failed to login. Please check your credentials.';
      
      const isCredentialError = 
        errorMessage.includes('auth/invalid-credential') || 
        errorMessage.includes('auth/wrong-password') ||
        errorMessage.includes('auth/user-not-found');

      if (isCredentialError) {
        try {
          const methods = await fetchSignInMethodsForEmail(auth, email);
          if (methods.includes('password')) {
            // Account has a password (may also have Google) — this is simply a wrong password
            errorMessage = '密码错误，请重试。您也可以点击下方「Forgot password?」重置密码，或使用 Google 登入。';
          } else if (methods.includes('google.com')) {
            // Google-only account, no password set — direct them to the Google button
            errorMessage = '此帳號使用 Google 註冊，尚未設置密碼。請點擊下方「Sign in with Google」登入。';
          } else if (methods.length > 0) {
            errorMessage = '密码错误，请重试。';
          } else {
            errorMessage = '电邮未注册';
          }
        } catch (methodErr) {
          // 如果 Firebase 开启了“电邮枚举保护”，fetchSignInMethodsForEmail 会抛出错误。
          // 此时我们退而求其次，检查我们的数据库中是否存在该会员。
          try {
            const { MembersService } = await import('../../services/membersService');
            const member = await MembersService.getMemberByEmail(email);
            if (member) {
              errorMessage = '电邮或密码错误。若您曾使用 Google 登入，请直接点击下方的 Google 登入，或重置密码。';
            } else {
              errorMessage = '电邮未注册';
            }
          } catch (e) {
            errorMessage = '电邮未注册';
          }
        }
      }
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);

    try {
      await signInWithGoogle();
      showToast('Login successful!', 'success');
      onClose();
    } catch (err: any) {
      let errorMessage = err?.message || 'Failed to login with Google.';
      if (errorMessage.includes('auth/invalid-credential')) {
        errorMessage = '电邮未注册';
      }
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sign In to JCI Kuala Lumpur">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <Input
          label="Email Address"
          type="email"
          placeholder="your.email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          icon={<Mail size={18} />}
        />

        <Input
          label="Password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          icon={<Lock size={18} />}
        />

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded border-slate-300" />
            <span className="text-slate-600">Remember me</span>
          </label>
          <button
            type="button"
            className="text-jci-blue hover:underline"
            onClick={() => setShowResetModal(true)}
          >
            Forgot password?
          </button>
        </div>

        <div className="space-y-3 pt-2">
          <Button
            type="submit"
            className="w-full"
            isLoading={loading}
            disabled={loading}
          >
            Sign In
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">Or continue with</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </Button>
        </div>

        {onSwitchToRegister && (
          <div className="text-center text-sm text-slate-600 pt-2">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => {
                onClose();
                onSwitchToRegister();
              }}
              className="text-jci-blue hover:underline font-medium"
            >
              Sign up
            </button>
          </div>
        )}
      </form>

      <Modal
        isOpen={showResetModal}
        onClose={() => {
          setShowResetModal(false);
          setResetEmail('');
          setError(null);
        }}
        title="Reset Password"
        footer={(
          <div className="flex gap-3 w-full">
            <Button
              form="reset-password-form"
              type="submit"
              className="flex-1"
              isLoading={resetLoading}
              disabled={resetLoading}
            >
              Send Reset Link
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowResetModal(false);
                setResetEmail('');
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        )}
      >
        <form
          id="reset-password-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);

            if (!resetEmail.trim()) {
              setError('Please enter your email address');
              return;
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) {
              setError('Please enter a valid email address');
              return;
            }

            setResetLoading(true);
            try {
              await resetPassword(resetEmail);
              showToast('Password reset email sent! Please check your inbox.', 'success');
              setShowResetModal(false);
              setResetEmail('');
            } catch (err: any) {
              const errorMessage = err?.message || 'Failed to send reset email. Please try again.';
              setError(errorMessage);
              showToast(errorMessage, 'error');
            } finally {
              setResetLoading(false);
            }
          }}
          className="space-y-4"
        >
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <p className="text-sm text-slate-600">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          <Input
            label="Email Address"
            type="email"
            placeholder="your.email@example.com"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            required
            icon={<Mail size={18} />}
          />
        </form>
      </Modal>
    </Modal>
  );
};

