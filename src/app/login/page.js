'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [msalInstance, setMsalInstance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load MSAL only on client side
  useEffect(() => {
    const initMsal = async () => {
      const { PublicClientApplication } = await import('@azure/msal-browser');
      const { msalConfig } = await import('@/lib/authConfig');
      const instance = new PublicClientApplication(msalConfig);
      await instance.initialize();

      // Handle redirect response (when user comes back after login)
      const result = await instance.handleRedirectPromise();
      if (result && result.account) {
        router.push('/dashboard');
        return;
      }

      setMsalInstance(instance);
    };

    initMsal().catch(console.error);
  }, [router]);

  const handleSignIn = async () => {
    if (!msalInstance) return;
    setLoading(true);
    setError(null);
    try {
      const { loginRequest } = await import('@/lib/authConfig');
      await msalInstance.loginRedirect(loginRequest);
    } catch (err) {
      setError('Sign in failed. Please try again.');
      setLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!msalInstance) return;
    setLoading(true);
    setError(null);
    try {
      const { loginRequest } = await import('@/lib/authConfig');
      await msalInstance.loginRedirect({
        ...loginRequest,
        prompt: 'create',
      });
    } catch (err) {
      setError('Sign up failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080C14] text-white flex flex-col relative overflow-hidden">

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-0 w-64 h-64 bg-violet-500/8 rounded-full blur-3xl" />
      </div>

      {/* LOGO */}
      <div className="relative z-10 flex flex-col items-center pt-20 pb-10">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-4xl shadow-2xl shadow-blue-500/30 mb-4">
          🐾
        </div>
        <h1 className="text-3xl font-black tracking-wider">GYM DOGS</h1>
        <p className="text-xs tracking-[3px] text-slate-500 uppercase mt-1">Built with vision. Powered by AI.</p>
      </div>

      {/* BUTTONS */}
      <div className="relative z-10 px-5 flex flex-col gap-4 flex-1">

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Sign In */}
        <button
          onClick={handleSignIn}
          disabled={loading || !msalInstance}
          className="w-full bg-gradient-to-r from-blue-500 to-violet-600 rounded-2xl py-4 text-white font-black tracking-widest text-sm uppercase shadow-lg shadow-blue-500/25 disabled:opacity-50"
        >
          {loading ? 'LOADING...' : 'SIGN IN →'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-1">
          <div className="flex-1 h-px bg-white/8" />
          <p className="text-xs text-slate-600 tracking-widest">OR</p>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        {/* Create Account */}
        <button
          onClick={handleCreateAccount}
          disabled={loading || !msalInstance}
          className="w-full bg-white/4 border border-white/8 rounded-2xl py-4 text-white font-bold text-sm tracking-wider disabled:opacity-50"
        >
          Create Account →
        </button>

        <p className="text-center text-xs text-slate-600 tracking-wider mt-4">
          Secured by Microsoft Entra
        </p>

      </div>
    </div>
  );
}