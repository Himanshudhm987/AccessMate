import React, { useEffect, useState } from 'react';
import { Flame, Zap, Wind, Sparkles } from 'lucide-react';

/**
 * Naruto Leaf / Uzumaki Spiral SVG insignia
 */
export function UzumakiSpiral({ size = 20, className = 'text-electric' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 4a6 6 0 1 1-6 6 6 6 0 0 1 6-6zm0 4a2 2 0 1 0 2 2 2 2 0 0 0-2-2z" />
    </svg>
  );
}

/**
 * Naruto Leaf Village Headband Plate
 */
export function ShinobiHeadbandPlate({ text = 'ACCESSMATE', className = '' }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 border border-slate-600 shadow-md ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      <UzumakiSpiral size={14} className="text-amber-400" />
      <span className="text-[10px] font-black tracking-widest text-slate-200 uppercase font-mono">
        {text}
      </span>
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
    </div>
  );
}

/**
 * Dual Rasengan / Kyuubi Swirling Chakra Sphere
 */
export function RasenganChakraSphere({ size = 70, active = true }) {
  if (!active) return null;

  return (
    <div
      className="relative flex items-center justify-center pointer-events-none select-none"
      style={{ width: size, height: size }}
    >
      {/* Outer Kyuubi Flame Aura */}
      <div
        className="absolute inset-0 rounded-full bg-gradient-to-tr from-flame via-amber-400 to-transparent opacity-60 blur-md kyuubi-glow"
      />

      {/* Inner Rasengan Electric Cyan Swirl */}
      <div
        className="absolute inset-2 rounded-full border-2 border-dashed border-electric rasengan-spin opacity-90 shadow-electric-glow"
      />

      {/* Secondary Counter-rotating Ring */}
      <div
        className="absolute inset-3 rounded-full border border-sky-300 opacity-70"
        style={{ animation: 'rasenganSpin 1.8s infinite reverse linear' }}
      />

      {/* Core Chakra Core */}
      <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_15px_#00D2FF]" />
    </div>
  );
}

/**
 * Ninja Substitution Jutsu "Poof" Smoke Animation Modal
 */
export function JutsuPoofOverlay({ active = false, text = 'Jutsu Activated!', onComplete = () => {} }) {
  const [step, setStep] = useState(0); // 0: seals, 1: smoke poof, 2: finish

  useEffect(() => {
    if (!active) {
      setStep(0);
      return;
    }

    // Hand seal 1 -> Hand seal 2 -> Poof
    const t1 = setTimeout(() => setStep(1), 350);
    const t2 = setTimeout(() => {
      setStep(2);
      onComplete();
    }, 1200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [active]);

  if (!active) return null;

  const handSeals = ['巳 (Snake)', '辰 (Dragon)', '寅 (Tiger)'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian-950/85 backdrop-blur-md"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center justify-center text-center space-y-4 jutsu-smoke-entrance">
        {step === 0 && (
          <div className="flex items-center gap-3 text-electric font-black text-lg tracking-widest anime-entrance">
            <Zap className="animate-bounce" />
            <span>NINPO: {handSeals[Math.floor(Date.now() / 200) % handSeals.length]}</span>
            <Flame className="text-flame animate-bounce" />
          </div>
        )}

        {step >= 1 && (
          <div className="relative flex flex-col items-center justify-center space-y-3">
            {/* Dual Chakra Rasengan Sphere */}
            <RasenganChakraSphere size={90} active={true} />

            {/* Substitution Jutsu Smoke Cloud */}
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-navy-800/95 border-2 border-electric text-white shadow-2xl chakra-glow">
              <Wind className="text-electric animate-spin" size={20} />
              <span className="text-sm font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-electric to-amber-400">
                {text}
              </span>
            </div>

            <p className="text-xs text-slate-300 font-mono">
              Chakra Synchronized • 忍術完了
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Ninja Rank Badge (Hokage, Jonin, Chunin, Genin)
 */
export function NinjaRankBadge({ role = 'user', className = '' }) {
  const ranks = {
    super_admin: {
      title: 'Hokage (火影)',
      color: 'bg-flame/20 border-flame text-amber-300 shadow-flame-glow',
      icon: Flame
    },
    admin: {
      title: 'Jonin (上忍)',
      color: 'bg-electric/20 border-electric text-electric shadow-electric-glow',
      icon: Zap
    },
    staff: {
      title: 'Chunin (中忍)',
      color: 'bg-purple-500/20 border-purple-400 text-purple-300',
      icon: Wind
    },
    user: {
      title: 'Genin (下忍)',
      color: 'bg-emerald-500/20 border-emerald-400 text-emerald-300',
      icon: Sparkles
    }
  };

  const current = ranks[role] || ranks.user;
  const Icon = current.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${current.color} ${className}`}
    >
      <Icon size={11} />
      <span>{current.title}</span>
    </span>
  );
}
