import React, { useState } from 'react';
import { X, Lock, Mail, User, Shield, Sparkles, KeyRound, AlertCircle, ArrowRight, Zap, Flame } from 'lucide-react';
import { RasenganChakraSphere, UzumakiSpiral, JutsuPoofOverlay } from './ShinobiAnimation.jsx';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, api, notify, setErrorMsg }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot' | 'reset'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [devTokenMsg, setDevTokenMsg] = useState('');
  const [showJutsuPoof, setShowJutsuPoof] = useState(false);
  const [jutsuText, setJutsuText] = useState('Chakra Activated!');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      if (mode === 'signup') {
        const data = await api('/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ name, email, password })
        });
        setJutsuText(`Ninpo: Shinobi Access Granted! Welcome, ${data.user.name}`);
        setShowJutsuPoof(true);
        setTimeout(() => {
          notify(`Welcome to AccessMate, ${data.user.name}!`);
          onAuthSuccess(data.user);
          onClose();
        }, 1200);
      } else if (mode === 'login') {
        const data = await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        setJutsuText(`Chakra Linked: Welcome Back, ${data.user.name}!`);
        setShowJutsuPoof(true);
        setTimeout(() => {
          notify(`Welcome back, ${data.user.name}!`);
          onAuthSuccess(data.user);
          onClose();
        }, 1200);
      } else if (mode === 'forgot') {
        const data = await api('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email })
        });
        if (data.devResetToken) {
          setDevTokenMsg(`Development Token Generated: ${data.devResetToken}`);
          setResetToken(data.devResetToken);
        }
        notify(data.message || 'Reset token generated.');
        setMode('reset');
      } else if (mode === 'reset') {
        const data = await api('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token: resetToken, newPassword })
        });
        notify(data.message || 'Password successfully reset. Please sign in.');
        setMode('login');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Jutsu Substitution Poof Overlay */}
      <JutsuPoofOverlay active={showJutsuPoof} text={jutsuText} />

      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian-950/85 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        {/* Naruto Shinobi Themed Card with Dual Kyuubi & Rasengan Glow */}
        <div className="relative w-full max-w-md panel border-navy-600/90 shadow-2xl jutsu-smoke-entrance overflow-hidden">
          {/* Subtle Kyuubi Flame and Rasengan Cyan Aura */}
          <div className="absolute -top-24 -right-24 w-52 h-52 bg-electric/25 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-52 h-52 bg-flame/25 rounded-full blur-3xl pointer-events-none" />

          {/* Naruto Shinobi Headband Strip */}
          <div className="flex items-center justify-between pb-3 border-b border-navy-700/80">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-electric/20 text-electric chakra-glow">
                <UzumakiSpiral size={22} className="text-electric" />
              </span>
              <div>
                <h2 id="auth-modal-title" className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                  {mode === 'signup' && 'Shinobi Registry — Sign Up'}
                  {mode === 'login' && 'Shinobi Portal — Sign In'}
                  {mode === 'forgot' && 'Reset Chakra Key'}
                  {mode === 'reset' && 'Set New Secret Password'}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {mode === 'signup' && 'Unlock bilingual cloud OCR & voice tools'}
                  {mode === 'login' && 'Enter your verified access credentials'}
                  {mode === 'forgot' && 'Enter your registered email address'}
                  {mode === 'reset' && 'Enter your reset token and new password'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-navy-700/60 transition"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tab switcher */}
          {mode !== 'reset' && (
            <div className="flex gap-2 p-1 mt-4 bg-navy-900/90 rounded-xl border border-navy-700">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                  mode === 'login' ? 'bg-navy-700 text-electric shadow-sm chakra-glow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(''); }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                  mode === 'signup' ? 'bg-navy-700 text-flame shadow-sm kyuubi-glow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1" htmlFor="auth-name">
                  Full Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                    <User size={15} />
                  </span>
                  <input
                    id="auth-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={80}
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Naruto Uzumaki"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-navy-900 border border-navy-700 rounded-xl text-white placeholder-slate-500 focus:border-electric"
                  />
                </div>
              </div>
            )}

            {mode !== 'reset' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1" htmlFor="auth-email">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                    <Mail size={15} />
                  </span>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="shinobi@accessmate.org"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-navy-900 border border-navy-700 rounded-xl text-white placeholder-slate-500 focus:border-electric"
                  />
                </div>
              </div>
            )}

            {mode === 'reset' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1" htmlFor="auth-token">
                    Reset Token
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                      <KeyRound size={15} />
                    </span>
                    <input
                      id="auth-token"
                      type="text"
                      required
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Paste 64-char reset token"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-navy-900 border border-navy-700 rounded-xl text-white placeholder-slate-500 focus:border-electric font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1" htmlFor="auth-new-pass">
                    New Password (min 8 chars)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                      <Lock size={15} />
                    </span>
                    <input
                      id="auth-new-pass"
                      type="password"
                      required
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-navy-900 border border-navy-700 rounded-xl text-white placeholder-slate-500 focus:border-electric"
                    />
                  </div>
                </div>
              </>
            )}

            {(mode === 'login' || mode === 'signup') && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300" htmlFor="auth-password">
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(''); }}
                      className="text-xs text-electric hover:underline"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                    <Lock size={15} />
                  </span>
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-navy-900 border border-navy-700 rounded-xl text-white placeholder-slate-500 focus:border-electric"
                  />
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {devTokenMsg && (
              <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs break-all font-mono">
                {devTokenMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className={`w-full py-2.5 rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 ${
                mode === 'signup' ? 'btn-flame' : 'btn-primary'
              }`}
            >
              {busy ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Weaving Hand Seals…
                </span>
              ) : (
                <>
                  {mode === 'signup' && 'Register Ninja License'}
                  {mode === 'login' && 'Open Chakra Session'}
                  {mode === 'forgot' && 'Send Recovery Key'}
                  {mode === 'reset' && 'Confirm Password'}
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Footer with Shinobi seal badge */}
          <div className="mt-4 pt-3 border-t border-navy-700 text-center text-xs text-slate-400">
            <p className="flex items-center justify-center gap-1.5 text-[11px]">
              <Sparkles size={12} className="text-electric" />
              Secured with Bcrypt Encryption & RBAC Shinobi Matrix
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
