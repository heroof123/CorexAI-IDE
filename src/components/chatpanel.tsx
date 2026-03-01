import { ChatPanelProps } from "./ChatPanel/types";
import { MessageItem } from "./ChatPanel/MessageItem";
import { useChatLogic } from "../hooks/useChatLogic";
import DiffViewer from "./Diffviewer";
import SmartSuggestions from "./SmartSuggestions";

export default function ChatPanel(props: ChatPanelProps) {
  const {
    messages,
    isLoading,
    onSendMessage,
    pendingActions,
    onAcceptAction,
    onRejectAction,
    onAcceptAllActions,
    onNewSession,
    isIndexing,
    currentFile,
    projectContext,
    onStopGeneration,
    onRegenerateResponse,
    isStreaming = false,
    modelName = "Corex AI",
    isMentorMode = false,
    onMentorModeToggle,
  } = props;

  const logic = useChatLogic(props);

  const quickActions = [
    {
      icon: "📖",
      text: "Açıkla",
      message: currentFile ? `${currentFile} açıkla` : "Bu projeyi açıkla",
    },
    {
      icon: "🐛",
      text: "Hata",
      message: currentFile ? `${currentFile} hata kontrolü yap` : "Hata kontrolü yap",
    },
    {
      icon: "🧪",
      text: "Test",
      message: currentFile ? `${currentFile} için test yaz` : "Test yaz",
    },
    {
      icon: "🎨",
      text: "Optimize",
      message: currentFile ? `${currentFile} optimize et` : "Optimize et",
    },
  ];

  return (
    <div className="h-full flex flex-col bg-[var(--color-background)] relative">
      {/* Oturum Geçmişi Dropdown */}
      {logic.showHistory && (
        <div
          style={{
            position: "absolute",
            bottom: 70,
            right: 8,
            zIndex: 9999,
            width: 260,
            background: "#181818",
            border: "1px solid #334155",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            maxHeight: 320,
            overflow: "auto",
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              fontSize: 11,
              fontWeight: 600,
              color: "#94a3b8",
              borderBottom: "1px solid #1e293b",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Sohbet Geçmişi</span>
            <button
              onClick={() => logic.setShowHistory(false)}
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              ✕
            </button>
          </div>
          {logic.sessions.length === 0 ? (
            <div
              style={{ padding: "16px 12px", color: "#64748b", fontSize: 11, textAlign: "center" }}
            >
              Henüz kayıtlı oturum yok
            </div>
          ) : (
            logic.sessions.map(s => (
              <div
                key={s.id}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  borderBottom: "1px solid #1e293b10",
                }}
                onClick={() => logic.setShowHistory(false)}
                className="hover:bg-neutral-800"
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--color-text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.title}
                </div>
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                  {new Date(s.createdAt).toLocaleDateString("tr-TR")} · {s.messages.length} mesaj
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Messages */}
      <div
        ref={logic.messagesContainerRef}
        onScroll={logic.checkScrollPosition}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0 custom-scrollbar"
      >
        {messages.length === 0 && (
          <div className="text-center text-neutral-500 text-xs mt-6">
            <p className="text-white font-medium mb-2">Corex AI ile sohbete başlayın 😊</p>
            <div className="grid grid-cols-1 gap-1.5 max-w-xs mx-auto mb-3">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => onSendMessage(action.message)}
                  className="px-2 py-1.5 bg-[var(--color-surface)] border-[var(--color-border)] rounded text-[10px] flex items-center gap-2"
                >
                  <span>{action.icon}</span>
                  <span>{action.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-2">
          {logic.messagesWithRatings.map(msg => (
            <MessageItem
              key={msg.id}
              msg={msg}
              onRate={logic.handleRate}
              onAutoFix={err => onSendMessage(`Please fix this terminal error: ${err}`)}
            />
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-[var(--color-surface)] border-[var(--color-border)] rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        style={{
                          width: 5,
                          height: 5,
                          background: "#3b82f6",
                          borderRadius: "50%",
                          animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-white text-[10px]">{modelName} düşünüyor...</span>
                </div>
              </div>
            </div>
          )}
          {logic.githubTask && (
            <div className="p-3 bg-neutral-900/50 border border-blue-500/30 rounded-lg my-2 font-mono">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-blue-400">🐙 GITHUB AGENT</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${logic.githubTask.status === 'done' ? 'bg-green-600' : logic.githubTask.status === 'failed' ? 'bg-red-600' : 'bg-blue-600'} text-white`}>
                  {logic.githubTask.status.toUpperCase()}
                </span>
              </div>
              <div className="max-h-32 overflow-y-auto text-[9px] text-neutral-300 space-y-1">
                {logic.githubTask.logs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
              {logic.githubTask.suggestions && logic.githubTask.suggestions.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="text-[9px] text-blue-400 font-bold mb-1">💡 Önerilen Özellikler:</div>
                  {logic.githubTask.suggestions.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => onSendMessage(`Lütfen şu özelliği implement et: ${suggestion}`)}
                      className="w-full text-left px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-[9px] text-blue-300 rounded border border-blue-500/20"
                    >
                      + {suggestion}
                    </button>
                  ))}
                </div>
              )}
              {logic.githubTask.status === 'done' && (
                <button
                  onClick={() => logic.setGithubTask(null)}
                  className="mt-2 w-full py-1 bg-neutral-800 hover:bg-neutral-700 text-[10px] text-neutral-400 rounded"
                >
                  Kapat
                </button>
              )}
            </div>
          )}
        </div>
        <div ref={logic.messagesEndRef} />
      </div>

      {/* Pending Actions */}
      {pendingActions.length > 0 && (
        <div className="flex-shrink-0 border-t border-neutral-800">
          <button
            onClick={() => logic.setIsPendingExpanded(!logic.isPendingExpanded)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-[var(--color-surface)]"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <span className={`transition-transform ${logic.isPendingExpanded ? "" : "-rotate-90"}`}>
                ▼
              </span>
              💡 Bekleyen Değişiklikler ({pendingActions.length})
            </div>
            {onAcceptAllActions && pendingActions.length > 1 && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  onAcceptAllActions();
                }}
                className="px-2 py-0.5 bg-green-600 hover:bg-green-700 text-white text-[10px] rounded"
              >
                ✓ Tümü
              </button>
            )}
          </button>
          {logic.isPendingExpanded && (
            <div className="max-h-[200px] overflow-y-auto p-2 space-y-2 bg-[var(--color-background)]">
              {pendingActions.map(action => (
                <DiffViewer
                  key={action.id}
                  filePath={action.filePath}
                  oldContent={action.oldContent || ""}
                  newContent={action.content}
                  onAccept={() => onAcceptAction(action.id)}
                  onReject={() => onRejectAction(action.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 border-t border-neutral-800 p-2 bg-[var(--color-background)]">
        <div className="relative">
          <SmartSuggestions
            input={logic.input}
            currentFile={currentFile}
            projectContext={projectContext}
            onSuggestionSelect={logic.setInput}
          />
          {logic.uploadedImages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {logic.uploadedImages.map((img, index) => (
                <div key={index} className="relative group">
                  <img
                    src={img}
                    className="w-16 h-16 object-cover rounded border-[var(--color-border)]"
                  />
                  <button
                    onClick={() => logic.removeImage(index)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center text-white text-[10px]"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <textarea
            ref={logic.textareaRef}
            className={`w-full bg-[var(--color-hover)] border transition-all duration-300 rounded-lg px-2.5 py-1.5 pr-10 text-xs outline-none resize-none text-[var(--color-text)] placeholder-neutral-500 ${logic.isSingularityMode ? 'border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)] focus:border-purple-400' : 'border-[var(--color-border)] focus:neon-border'}`}
            placeholder={isIndexing ? "🧠 Proje indeksleniyor..." : logic.isSingularityMode ? "👑 Otonom Agent görev için hazır..." : "✨ AI ile sohbet et..."}
            rows={1}
            value={logic.input}
            onChange={e => logic.setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                logic.handleSend();
              }
            }}
            onPaste={logic.handlePaste}
            disabled={isLoading || isIndexing}
          />
          <button
            onClick={logic.handleSend}
            disabled={isLoading || isIndexing || !logic.input.trim()}
            className="absolute right-1.5 bottom-1.5 p-1.5 rounded-md bg-[var(--color-primary)] text-white disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-400 font-medium">
          <div className="flex items-center gap-1">
            {onNewSession && (
              <button
                onClick={onNewSession}
                className="px-2 py-1 cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-center rounded text-neutral-500 hover:text-neutral-300"
                title="Yeni Oturum"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            )}

            <div className="relative dropdown-container">
              <button
                onClick={() => {
                  logic.setShowMentorDropdown(!logic.showMentorDropdown);
                  logic.setShowAgentDropdown(false);
                }}
                className={`flex items-center gap-1 px-2 py-1 cursor-pointer rounded transition-all group ${logic.showMentorDropdown ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-neutral-400'}`}
                title="Model / Mentor Seçimi"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`opacity-50 transition-transform ${logic.showMentorDropdown ? 'rotate-180' : ''}`}><path d="M18 15l-6-6-6 6" /></svg>
                <span className={isMentorMode ? "text-blue-400 drop-shadow-md" : "text-neutral-400"}>{isMentorMode ? "Mentor" : "Fast"}</span>
              </button>

              {logic.showMentorDropdown && (
                <div className="absolute bottom-full left-0 mb-1 w-32 bg-[#181818] border border-neutral-800 rounded-lg shadow-xl overflow-hidden z-50 py-1 font-sans">
                  <button
                    onClick={() => {
                      if (onMentorModeToggle) onMentorModeToggle(false);
                      logic.setShowMentorDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors flex items-center gap-2 ${!isMentorMode ? 'bg-white/10 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
                  >
                    ⚡ Fast Model
                  </button>
                  <button
                    onClick={() => {
                      if (onMentorModeToggle) onMentorModeToggle(true);
                      logic.setShowMentorDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors flex items-center gap-2 ${isMentorMode ? 'bg-blue-500/20 text-blue-400' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
                  >
                    🧠 Mentor
                  </button>
                </div>
              )}
            </div>

            <div className="relative dropdown-container">
              <button
                onClick={() => {
                  logic.setShowAgentDropdown(!logic.showAgentDropdown);
                  logic.setShowMentorDropdown(false);
                }}
                className={`flex items-center gap-1 px-2 py-1 cursor-pointer rounded transition-all group ${logic.showAgentDropdown ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-neutral-400'}`}
                title="Ajan Modu Seçimi"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`opacity-50 transition-transform ${logic.showAgentDropdown ? 'rotate-180' : ''}`}><path d="M18 15l-6-6-6 6" /></svg>
                <span className={logic.isSingularityMode ? "text-purple-400 drop-shadow-md" : "text-neutral-400"}>{logic.isSingularityMode ? "Agent Otonom" : modelName}</span>
              </button>

              {logic.showAgentDropdown && (
                <div className="absolute bottom-full left-0 mb-1 w-40 bg-[#181818] border border-neutral-800 rounded-lg shadow-xl overflow-hidden z-50 py-1 font-sans">
                  <button
                    onClick={() => {
                      logic.setIsSingularityMode(false);
                      logic.setShowAgentDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors flex items-center gap-2 ${!logic.isSingularityMode ? 'bg-white/10 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
                  >
                    💬 Normal AI
                  </button>
                  <button
                    onClick={() => {
                      logic.setIsSingularityMode(true);
                      logic.setShowAgentDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors flex items-center gap-2 ${logic.isSingularityMode ? 'bg-purple-500/20 text-purple-400 font-medium' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
                  >
                    👑 Agent Otonom
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => logic.fileInputRef.current?.click()}
              className="px-2 py-1 cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-center rounded ml-1 text-neutral-500 hover:text-neutral-300"
              title="Görsel Yükle"
            >
              📷
            </button>
            <input
              ref={logic.fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={logic.handleImageUpload}
              className="hidden"
            />
          </div>
          <div className="flex items-center gap-2">
            {isIndexing && (
              <span className="text-[9px] text-blue-400/70 animate-pulse font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span> İndeksleniyor
              </span>
            )}
            <button
              onClick={() => {
                logic.refreshSessions();
                logic.setShowHistory(h => !h);
              }}
              className="px-2 py-1 text-[10px] text-neutral-500 hover:text-neutral-300 rounded transition-colors"
              title="Sohbet Geçmişi"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </button>
            {isStreaming && onStopGeneration && (
              <button onClick={onStopGeneration} className="text-red-400 hover:text-red-300 px-2 py-1">
                Durdur
              </button>
            )}
            {!isStreaming && !isLoading && messages.length > 0 && onRegenerateResponse && (
              <button onClick={onRegenerateResponse} className="hover:text-neutral-300 px-2 py-1">
                🔄 Yeniden
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
