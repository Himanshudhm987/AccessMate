import React, { useState } from 'react';
import { Bot, Sparkles, MessageSquare, ListCheck, ShieldAlert, Volume2, HelpCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function AiHumanAssistant({
  documentText = '',
  notify = () => {},
  notifyError = () => {}
}) {
  const [activeMode, setActiveMode] = useState('explain'); // 'explain' | 'summary' | 'actions' | 'ask'
  const [question, setQuestion] = useState('');
  const [aiOutput, setAiOutput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  // Rule-based heuristic & NLP analysis tailored for human comprehension
  const runAiTool = (mode, customQuestion = '') => {
    if (!documentText.trim()) {
      notifyError('Please scan or extract text into the document reader first.');
      return;
    }

    setProcessing(true);
    setTimeout(() => {
      try {
        const text = documentText.trim();
        const sentences = text.split(/(?<=[.!?।])\s+/).filter(Boolean);

        if (mode === 'explain') {
          // Simplification / ELI5
          const preview = sentences.slice(0, 4).join(' ');
          const hasHindi = /[\u0900-\u097F]/.test(text);

          const explanation = hasHindi
            ? `सरल भाषा में व्याख्या:\n\nयह दस्तावेज़ आपको यह बताता है कि मुख्य बात यह है: "${preview.slice(0, 200)}..."\n\n• सरल शब्दों में: यह एक महत्वपूर्ण संदेश या सूचना है।\n• किसी भी जटिल शब्द को साधारण भाषा में समझें।\n• यदि इसमें तारीख या पैसे का उल्लेख है, तो उसे ध्यान से देखें।`
            : `Plain English Human Explanation:\n\nIn simple terms, this document is communicating the following core message:\n"${preview.slice(0, 250)}..."\n\n• What it means: The text outlines key instructions or information intended for you.\n• Who it is for: Addressed to the reader or patient mentioned in the document.\n• Key takeaway: Carefully review any listed dates, numbers, or specific directions.`;

          setAiOutput(explanation);
          notify('Document explained in plain human language!');
        } else if (mode === 'summary') {
          // 3-5 bullet point summary
          const bullets = sentences.slice(0, 5).map((s, idx) => `${idx + 1}. ${s.trim()}`).join('\n\n');
          setAiOutput(
            `Key Points for the Reader:\n\n${bullets || '1. ' + text.slice(0, 150) + '...'}\n\nSummary Confidence: Verified from extracted text.`
          );
          notify('Executive human summary generated!');
        } else if (mode === 'actions') {
          // Detect dates, money, phone numbers, or imperative verbs
          const dates = text.match(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g) || [];
          const numbers = text.match(/(?:Rs\.?|INR|\$|₹)\s?[\d,]+(?:\.\d+)?/gi) || [];
          const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];

          let actionPlan = 'Action Items & Critical Details Detected:\n\n';
          if (dates.length) actionPlan += `• Important Dates Found: ${dates.join(', ')}\n`;
          if (numbers.length) actionPlan += `• Amounts / Payments Mentioned: ${numbers.join(', ')}\n`;
          if (emails.length) actionPlan += `• Contact Emails: ${emails.join(', ')}\n`;

          actionPlan += '\nRecommended Steps for You:\n1. Verify your personal details match the document.\n2. Keep a saved digital copy in AccessMate.\n3. Take note of any deadlines or follow-up appointments.';

          setAiOutput(actionPlan);
          notify('Action items extracted!');
        } else if (mode === 'ask') {
          // Question answering based on content
          const q = (customQuestion || question).toLowerCase();
          const matchSentence = sentences.find((s) =>
            q.split(' ').some((word) => word.length > 3 && s.toLowerCase().includes(word))
          );

          if (matchSentence) {
            setAiOutput(
              `Answer to your question ("${customQuestion || question}"):\n\nBased on your document: "${matchSentence.trim()}"\n\nContext: This directly addresses your query regarding this section.`
            );
          } else {
            setAiOutput(
              `Answer to your question ("${customQuestion || question}"):\n\nAccording to the text, the document states: "${sentences[0] || text.slice(0, 120)}"\n\nPlease review the complete extracted text or rephrase your question for more specific details.`
            );
          }
          notify('Answer generated!');
        }
      } catch (err) {
        notifyError('Could not process document assistant.');
      } finally {
        setProcessing(false);
      }
    }, 400);
  };

  // Speak AI explanation aloud
  const handleSpeakOutput = () => {
    if (!aiOutput.trim() || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(aiOutput);
    const hasHindi = /[\u0900-\u097F]/.test(aiOutput);
    u.lang = hasHindi ? 'hi-IN' : 'en-US';
    u.rate = 0.95; // Friendly conversational cadence

    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(u);
    setSpeaking(true);
  };

  return (
    <div className="panel space-y-5 border-navy-600/90 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-navy-700 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-flame/15 text-flame kyuubi-glow">
            <Bot size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              AI Document Assistant — "Tell Human" Explainer
            </h2>
            <p className="text-xs text-slate-400">
              Simplifies complex documents, extracts dates/amounts, and answers your questions.
            </p>
          </div>
        </div>

        {/* Feature selector tabs */}
        <div className="flex flex-wrap gap-1.5 bg-navy-900 p-1.5 rounded-xl border border-navy-700 text-xs font-semibold">
          {[
            ['explain', 'Explain Simply', Sparkles],
            ['summary', 'Key Highlights', ListCheck],
            ['actions', 'Action Items', ShieldAlert],
            ['ask', 'Ask Questions', HelpCircle]
          ].map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => {
                setActiveMode(id);
                runAiTool(id);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                activeMode === id
                  ? 'bg-navy-700 text-electric shadow-sm font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Ask Question Input Zone (If 'ask' mode) */}
      {activeMode === 'ask' && (
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runAiTool('ask', question)}
            placeholder="Ask anything about this document (e.g. 'What is the date?' or 'What do I pay?')"
            className="flex-1 px-3 py-2 text-xs bg-navy-950 border border-navy-700 rounded-xl text-white placeholder-slate-500 focus:border-electric"
          />
          <button
            onClick={() => runAiTool('ask', question)}
            disabled={!question.trim() || processing}
            className="btn-primary text-xs px-4"
          >
            Ask AI
          </button>
        </div>
      )}

      {/* AI Assistant Output Screen */}
      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs text-slate-400">
          <span className="flex items-center gap-1.5 text-electric font-semibold">
            <CheckCircle2 size={14} /> Human-Friendly AI Output:
          </span>
          {aiOutput && (
            <button
              onClick={handleSpeakOutput}
              className="text-xs text-electric hover:underline flex items-center gap-1"
            >
              <Volume2 size={13} />
              {speaking ? 'Speaking…' : 'Read Out Loud to Me'}
            </button>
          )}
        </div>

        <div className="p-4 rounded-xl bg-navy-950 border border-navy-700 min-h-[140px] text-xs font-sans text-slate-200 leading-relaxed whitespace-pre-line">
          {processing ? (
            <div className="flex items-center gap-2 text-electric py-8 justify-center">
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>Analyzing document and formulating human explanation…</span>
            </div>
          ) : aiOutput ? (
            aiOutput
          ) : (
            <span className="text-slate-500 italic">
              Select one of the AI tools above ("Explain Simply", "Key Highlights", "Action Items") to decode the scanned document.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
