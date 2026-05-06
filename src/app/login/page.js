'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Azure AD B2C login will go here
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#080C14] flex flex-col items-center justify-center px-6">
      
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-2/3 left-1/3 w-64 h-64 bg-violet-500/8 rounded-full blur-3xl" />
      </div>

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center mb-10">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-4xl mb-4 shadow-lg shadow-blue-500/30">
          🐕
        </div>
        <h1 className="text-4xl font-black tracking-widest bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
          GYM DOGS
        </h1>
        <p className="text-xs tracking-[4px] text-slate-500 mt-1 uppercase">
          Coach Platform
        </p>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm bg-white/4 border border-white/8 rounded-3xl p-8 backdrop-blur-sm">
        
        <h2 className="text-2xl font-bold text-white mb-1">
          Welcome <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">back.</span>
        </h2>
        <p className="text-sm text-slate-400 mb-8">Sign in to continue your journey</p>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          
          {/* Email */}
          <div>
            <label className="text-xs tracking-widest text-slate-500 uppercase mb-2 block">
              Email
            </label>
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-4">
              <span className="text-lg">✉️</span>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-transparent text-white placeholder-slate-600 text-sm outline-none flex-1"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-xs tracking-widest text-slate-500 uppercase mb-2 block">
              Password
            </label>
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-4">
              <span className="text-lg">🔒</span>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-transparent text-white placeholder-slate-600 text-sm outline-none flex-1"
                required
              />
            </div>
          </div>

          {/* Forgot */}
          <div className="text-right">
            <span className="text-xs text-blue-400 cursor-pointer hover:text-blue-300">
              Forgot password?
            </span>
          </div>

          {/* Sign in button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-violet-600 text-white font-bold text-sm tracking-widest py-4 rounded-2xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02] transition-all duration-200 disabled:opacity-50"
          >
            {loading ? 'SIGNING IN...' : 'SIGN IN'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-xs text-slate-600">or continue with</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          {/* Google */}
          <button
            type="button"
            className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 rounded-2xl py-4 text-sm text-slate-300 hover:bg-white/8 transition-all duration-200"
          >
            <span className="text-lg">🔵</span>
            Continue with Google
          </button>

        </form>

        {/* Sign up */}
        <p className="text-center text-xs text-slate-500 mt-6">
          New here?{' '}
          <span className="text-blue-400 font-semibold cursor-pointer hover:text-blue-300">
            Create account
          </span>
        </p>

      </div>
    </div>
  );
}