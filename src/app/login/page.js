'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '@/lib/authConfig';

const FALLBACK_QUOTES = [
  "The only bad workout is the one that didn't happen.",
  "Strength doesn't come from what you can do. It comes from overcoming what you thought you couldn't.",
  "Push yourself because no one else is going to do it for you.",
  "Your body can stand almost anything. It's your mind you have to convince.",
  "Don't limit your challenges. Challenge your limits.",
  "Wake up. Work out. Be better.",
  "The pain you feel today is the strength you feel tomorrow.",
  "Champions aren't made in gyms. They're made from something deep inside.",
];

export default function LoginPage() {
  const router = useRouter();
  const { instance, accounts, inProgress } = useMsal();
  const [quote, setQuote] = useState('');
  const [quoteLoading, setQuoteLoading] = useState(true);

  // If already logged in, go straight to dashboard
  useEffect(() => {
    if (inProgress !== 'none') return;
    if (accounts.length > 0) {
      router.push('/dashboard');
    }
  }, [accounts, inProgress, router]);

  // Handle the redirect coming back from Microsoft
  useEffect(() => {
    instance.handleRedirectPromise().then((result) => {
      if (result && result.account) {
        router.push('/dashboard');
      }
    }).catch(console.error);
  }, [instance, router]);

  // Fetch AI motivational quote on load
  useEffect(() => {
    const fetchQuote = async () => {
      try {
        const res = await fetch(
          'https://gymdogs-api-g9d0gve4angygdcj.newzealandnorth-01.azurewebsites.net/api/aiCoach',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-functions-key': process.env.NEXT_PUBLIC_AI_COACH_KEY
            },
            body: JSON.stringify({
              message: 'Give me one short, punchy motivational gym quote. Maximum 12 words. No quotation marks. No attribution. Just the quote itself, nothing else.'
            })
          }
        );
        if (res.ok) {
          const data = await res.json();
          setQuote(data.reply || FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)]);
        } else {
          setQuote(FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)]);
        }
      } catch (e) {
        setQuote(FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)]);
      } finally {
        setQuoteLoading(false);
      }
    };
    fetchQuote();
  }, []);

  const handleSignIn = () => {
    instance.loginRedirect(loginRequest);
  };

  const handleCreateAccount = () => {
    instance.loginRedirect({ ...loginRequest, prompt: 'create' });
  };

  return (
    <div className="min-h-screen bg-[#080C14] text-white flex flex-col items-center justify-center relative overflow-hidden px-6">

      {/* Background glow effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-violet-600/15 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-64 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">

        {/* Logo */}
        <div className="mb-6 flex flex-col items-center">
          <img
            src="/images/gymdogs_logo.png"
            alt="Gym Dogs"
            className="w-44 h-44 object-contain drop-shadow-2xl"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>

        {/* Title */}
        <h1 className="text-4xl font-black tracking-[4px] uppercase mb-1">GYM DOGS</h1>

        {/* AI Motivational Quote */}
        <div className="mb-10 min-h-[40px] flex items-center justify-center px-4">
          {quoteLoading ? (
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" />
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0.15s' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          ) : (
            <p className="text-xs tracking-[2px] text-slate-400 uppercase text-center leading-relaxed">
              {quote}
            </p>
          )}
        </div>

        {/* Sign In Button */}
        <button
          onClick={handleSignIn}
          disabled={inProgress !== 'none'}
          className="w-full flex items-center rounded-2xl overflow-hidden mb-4 shadow-lg shadow-blue-500/20 disabled:opacity-50 active:scale-98 transition-transform"
        >
          <div className="bg-white/10 p-4 flex items-center justify-center">
            <span className="text-xl">🐾</span>
          </div>
          <div className="flex-1 bg-gradient-to-r from-blue-500 to-violet-600 py-4 flex items-center justify-center gap-2">
            <span className="font-black tracking-[3px] text-sm uppercase">
              {inProgress !== 'none' ? 'Loading...' : 'Sign In'}
            </span>
            <span className="text-base">→</span>
          </div>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 w-full my-2">
          <div className="flex-1 h-px bg-white/8" />
          <p className="text-xs text-slate-600 tracking-[3px]">OR</p>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        {/* Create Account Button */}
        <button
          onClick={handleCreateAccount}
          disabled={inProgress !== 'none'}
          className="w-full flex items-center bg-white/5 border border-white/8 rounded-2xl overflow-hidden mt-4 disabled:opacity-50 active:scale-98 transition-transform"
        >
          <div className="bg-white/5 p-4 flex items-center justify-center">
            <span className="text-xl">🐾</span>
          </div>
          <div className="flex-1 py-4 flex items-center justify-center gap-2">
            <span className="font-bold tracking-[2px] text-sm text-slate-300">Create Account</span>
            <span className="text-base text-slate-400">→</span>
          </div>
        </button>

        {/* Footer */}
        <div className="flex items-center gap-2 mt-8 text-slate-600">
          <span className="text-sm">🛡️</span>
          <p className="text-xs tracking-[2px]">Secured by Microsoft Entra</p>
        </div>

      </div>
    </div>
  );
}