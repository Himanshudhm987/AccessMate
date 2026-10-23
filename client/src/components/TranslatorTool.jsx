import React, { useState } from 'react';
import { Languages, ArrowLeftRight, Volume2, Copy, Download, Save, RefreshCw, Check, Sparkles } from 'lucide-react';

export default function TranslatorTool({
  initialText = '',
  onSaveTranslated = () => {},
  notify = () => {},
  notifyError = () => {}
}) {
  const [sourceText, setSourceText] = useState(initialText);
  const [targetText, setTargetText] = useState('');
  const [sourceLang, setSourceLang] = useState('hi'); // 'hi' | 'en'
  const [targetLang, setTargetLang] = useState('en');
  const [translating, setTranslating] = useState(false);
  const [speakingTarget, setSpeakingTarget] = useState(false);

  // Sync if initialText changes from OCR
  React.useEffect(() => {
    if (initialText) {
      setSourceText(initialText);
      // Auto-detect if Hindi
      const isHindi = /[\u0900-\u097F]/.test(initialText);
      if (isHindi) {
        setSourceLang('hi');
        setTargetLang('en');
      } else {
        setSourceLang('en');
        setTargetLang('hi');
      }
    }
  }, [initialText]);

  // Swap language directions
  const handleSwap = () => {
    const prevSrc = sourceLang;
    const prevTgt = targetLang;
    setSourceLang(prevTgt);
    setTargetLang(prevSrc);

    // Swap text if both exist
    if (targetText) {
      const prevText = sourceText;
      setSourceText(targetText);
      setTargetText(prevText);
    }
  };

  // Perform translation
  const handleTranslate = async () => {
    if (!sourceText.trim()) {
      notifyError('Please enter or extract text to translate.');
      return;
    }

    setTranslating(true);
    try {
      // Use MyMemory public API with URI encoding
      const pair = `${sourceLang}|${targetLang}`;
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
        sourceText.slice(0, 1000)
      )}&langpair=${pair}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data && data.responseData && data.responseData.translatedText) {
        setTargetText(data.responseData.translatedText);
        notify('Translation completed!');
      } else {
        throw new Error('Could not translate text.');
      }
    } catch (err) {
      // Fallback: simple vocabulary mapping or notification
      notifyError('Online translation temporarily unavailable. Please verify internet connection.');
    } finally {
      setTranslating(false);
    }
  };

  // Read aloud translated text
  const handleSpeakTranslation = () => {
    if (!targetText.trim() || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(targetText);
    u.lang = targetLang === 'hi' ? 'hi-IN' : 'en-US';
    u.rate = 1;

    u.onend = () => setSpeakingTarget(false);
    u.onerror = () => setSpeakingTarget(false);

    window.speechSynthesis.speak(u);
    setSpeakingTarget(true);
  };

  const handleCopyTarget = async () => {
    try {
      await navigator.clipboard.writeText(targetText);
      notify('Translated text copied to clipboard!');
    } catch {
      notifyError('Failed to copy to clipboard.');
    }
  };

  return (
    <div className="panel space-y-4 border-navy-600/90 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-navy-700 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-electric/15 text-electric chakra-glow">
            <Languages size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Bilingual Hindi ↔ English Translator
            </h2>
            <p className="text-xs text-slate-400">
              Instantly convert between Hindi Devanagari and English with speech playback.
            </p>
          </div>
        </div>

        {/* Language selector and swap */}
        <div className="flex items-center gap-2 bg-navy-900 p-1.5 rounded-xl border border-navy-700 text-xs font-semibold">
          <span className="px-2 py-1 text-electric font-bold">
            {sourceLang === 'hi' ? 'Hindi (हिंदी)' : 'English'}
          </span>
          <button
            onClick={handleSwap}
            className="p-1 rounded-lg hover:bg-navy-700 text-slate-300 hover:text-white transition"
            title="Swap Languages"
            aria-label="Swap translation direction"
          >
            <ArrowLeftRight size={14} />
          </button>
          <span className="px-2 py-1 text-flame font-bold">
            {targetLang === 'hi' ? 'Hindi (हिंदी)' : 'English'}
          </span>
        </div>
      </div>

      {/* Split Text Translation Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source Text Box */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Source Text ({sourceLang === 'hi' ? 'Hindi' : 'English'})</span>
            <span className="font-mono">{sourceText.length} chars</span>
          </div>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Type or paste text to translate…"
            className="w-full min-h-[180px] p-3 text-xs bg-navy-950 border border-navy-700 rounded-xl text-white placeholder-slate-600 focus:border-electric resize-y font-sans leading-relaxed"
          />
        </div>

        {/* Target Translation Box */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Translated Output ({targetLang === 'hi' ? 'Hindi' : 'English'})</span>
            <span className="font-mono">{targetText.length} chars</span>
          </div>
          <textarea
            readOnly
            value={targetText}
            placeholder="Translation will appear here…"
            className="w-full min-h-[180px] p-3 text-xs bg-navy-900/90 border border-navy-700 rounded-xl text-electric placeholder-slate-600 resize-y font-sans leading-relaxed"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          onClick={handleTranslate}
          disabled={translating || !sourceText.trim()}
          className="btn-primary text-xs px-5 py-2.5"
        >
          {translating ? (
            <span className="flex items-center gap-2">
              <RefreshCw size={14} className="animate-spin" /> Translating…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles size={14} /> Translate Now
            </span>
          )}
        </button>

        <div className="flex flex-wrap gap-2">
          <button
            disabled={!targetText}
            onClick={handleSpeakTranslation}
            className="btn-secondary text-xs"
          >
            <Volume2 size={14} /> {speakingTarget ? 'Speaking…' : 'Listen Output'}
          </button>
          <button
            disabled={!targetText}
            onClick={handleCopyTarget}
            className="btn-secondary text-xs"
          >
            <Copy size={14} /> Copy
          </button>
          <button
            disabled={!targetText}
            onClick={() => onSaveTranslated(targetText, `Translation (${targetLang})`)}
            className="btn-flame text-xs"
          >
            <Save size={14} /> Save Translation
          </button>
        </div>
      </div>
    </div>
  );
}
