import React, { useState } from 'react';
import { useAIWorkspace } from '../../hooks/useAIWorkspace';
import { AIPermissionBanner } from './AIPermissionBanner';
import { AIRiskRadar } from './AIRiskRadar';
import { AITaskRecommender } from './AITaskRecommender';
import { AIProjectSummarizer } from './AIProjectSummarizer';
import {
  Bot,
  Send,
  Sparkles,
  RefreshCcw,
  Zap,
  ShieldCheck,
  Building,
  Film,
  BookOpen,
  ArrowRight,
  Sliders,
  Layers,
} from 'lucide-react';

export const AIWorkspace: React.FC = () => {
  const {
    messages,
    risks,
    taskRecommendations,
    activeProjectSummary,
    activeShotSummary,
    permissionContext,
    isThinking,
    sendMessage,
    resolveRisk,
    applyRecommendation,
    loadProjectSummary,
    clearChat,
  } = useAIWorkspace();

  const [inputQuery, setInputQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'assistant' | 'risks' | 'recommendations' | 'summaries'>('assistant');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || isThinking) return;
    sendMessage(inputQuery.trim());
    setInputQuery('');
  };

  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Security & Isolation Banner */}
      <AIPermissionBanner context={permissionContext} />

      {/* Main Workspace Header */}
      <header className="px-6 py-3.5 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between flex-wrap gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Platform Intelligence & AI Workspace</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                Active
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Studio copilot, schedule bottleneck analysis, Q&A, and smart task assignment
            </p>
          </div>
        </div>

        {/* Workspace Mode Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            id="tab-ai-assistant"
            onClick={() => setActiveTab('assistant')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'assistant'
                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Copilot</span>
          </button>

          <button
            id="tab-ai-risks"
            onClick={() => setActiveTab('risks')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'risks'
                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Risk Radar ({risks.length})</span>
          </button>

          <button
            id="tab-ai-recommendations"
            onClick={() => setActiveTab('recommendations')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'recommendations'
                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Rebalancer ({taskRecommendations.length})</span>
          </button>

          <button
            id="tab-ai-summaries"
            onClick={() => setActiveTab('summaries')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'summaries'
                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Project Summaries</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 overflow-hidden flex">
        {activeTab === 'assistant' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Chat Stream Main Pane */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Messages Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 max-w-4xl mx-auto w-full">
                {messages.map((msg) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && (
                        <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0 mt-1">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}

                      <div
                        className={`max-w-2xl rounded-2xl p-4 text-xs space-y-2.5 shadow-sm leading-relaxed ${
                          isUser
                            ? 'bg-indigo-600 text-white font-medium rounded-br-xs'
                            : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-bl-xs'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{msg.content}</div>

                        {/* Citations if any */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="pt-2 border-t border-slate-800/80 space-y-1">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                              <BookOpen className="w-3 h-3 text-indigo-400" />
                              Knowledge Citation
                            </div>
                            {msg.citations.map((c, idx) => (
                              <div
                                key={idx}
                                className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300"
                              >
                                <strong className="text-indigo-300">{c.title}</strong>
                                <p className="text-[10px] text-slate-400 mt-0.5">{c.snippet}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Suggested Followups */}
                        {msg.suggested_followups && msg.suggested_followups.length > 0 && (
                          <div className="pt-2 border-t border-slate-800/60 flex flex-wrap gap-1.5">
                            {msg.suggested_followups.map((followup, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleQuickPrompt(followup)}
                                className="text-[10px] px-2.5 py-1 rounded-full bg-slate-950 hover:bg-slate-800 text-indigo-300 hover:text-white border border-indigo-500/20 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <span>{followup}</span>
                                <ArrowRight className="w-2.5 h-2.5" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isThinking && (
                  <div className="flex gap-3.5">
                    <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0">
                      <Sparkles className="w-4 h-4 animate-spin" />
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-xs text-slate-400 flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                      <span>Synthesizing cross-department production graph...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input Box */}
              <div className="p-4 border-t border-slate-800 bg-slate-900/50 shrink-0">
                <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center gap-2">
                  <input
                    id="input-ai-copilot-query"
                    type="text"
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    placeholder="Ask about project velocity, USD pipeline standards, risk mitigation, or shot status..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
                  />
                  <button
                    id="btn-ai-send-message"
                    type="submit"
                    disabled={!inputQuery.trim() || isThinking}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Ask AI</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Right Live Insights Rail */}
            <aside className="w-full md:w-80 border-t md:border-t-0 md:border-l border-slate-800/80 bg-slate-950/60 p-4 space-y-4 overflow-y-auto shrink-0">
              <AIRiskRadar risks={risks.slice(0, 2)} onResolveRisk={resolveRisk} />
              <AITaskRecommender recommendations={taskRecommendations.slice(0, 2)} onApplyRecommendation={applyRecommendation} />
            </aside>
          </div>
        )}

        {activeTab === 'risks' && (
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
            <AIRiskRadar risks={risks} onResolveRisk={resolveRisk} />
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
            <AITaskRecommender recommendations={taskRecommendations} onApplyRecommendation={applyRecommendation} />
          </div>
        )}

        {activeTab === 'summaries' && (
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
            {/* Show Selector */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadProjectSummary('NK99')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono border cursor-pointer ${
                  activeProjectSummary?.project_code === 'NK99'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                [NK99] Nebula Knights
              </button>
              <button
                onClick={() => loadProjectSummary('DUNE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono border cursor-pointer ${
                  activeProjectSummary?.project_code === 'DUNE'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                [DUNE] Dune Sisterhood
              </button>
            </div>

            <AIProjectSummarizer
              summary={activeProjectSummary}
              shotSummary={activeShotSummary}
            />
          </div>
        )}
      </div>
    </div>
  );
};
