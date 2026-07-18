import React, { useState, useRef, useEffect } from 'react';
import { 
  SendHorizontal, 
  TerminalSquare, 
  Loader2, 
  Plus, 
  MessageSquare, 
  PanelLeftClose, 
  PanelLeft, 
  Trash2, 
  Terminal, 
  Copy, 
  Check, 
  Code, 
  Edit3, 
  Save, 
  X,
  Brain
} from 'lucide-react';
import Markdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message, ChatSession } from './types';
import { applyScriptEdits } from './lib/luauParser';

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('luau-chats');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });
  
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    sessions.length > 0 ? sessions[0].id : null
  );
  
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash');
  const [thinkingEnabled, setThinkingEnabled] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Terminal/Code view states
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editedCode, setEditedCode] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId) || null;
  const messages = currentSession?.messages || [];

  // Sync editedCode when currentSession changes
  useEffect(() => {
    setEditedCode(currentSession?.code || '');
  }, [currentSessionId, currentSession?.code]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  // Save to localStorage whenever sessions change
  useEffect(() => {
    localStorage.setItem('luau-chats', JSON.stringify(sessions));
  }, [sessions]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setInput('');
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      if (currentSessionId === id) {
        setCurrentSessionId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  };

  const selectSession = (id: string) => {
    setCurrentSessionId(id);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userContent = input.trim();
    setInput('');
    setIsGenerating(true);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userContent
    };

    let targetSessionId = currentSessionId;
    let targetMessages = [...messages, userMessage];

    if (!targetSessionId) {
      // Create new session
      const newSession: ChatSession = {
        id: crypto.randomUUID(),
        title: userContent.slice(0, 30) + (userContent.length > 30 ? '...' : ''),
        createdAt: Date.now(),
        messages: targetMessages
      };
      setSessions(prev => [newSession, ...prev]);
      targetSessionId = newSession.id;
      setCurrentSessionId(newSession.id);
    } else {
      // Update existing session
      setSessions(prev => prev.map(s => {
        if (s.id === targetSessionId) {
          return { ...s, messages: targetMessages };
        }
        return s;
      }));
    }

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: targetMessages, selectedModel, thinkingEnabled })
      });

      const data = await response.json();

      if (!response.ok) {
        const errType = data.error || data.message;
        if (errType === 'QUOTA_EXHAUSTED') {
          setError('Cota excedida: A cota do modelo está esgotada, troque o modelo ou se quiser continuar usando o mesmo modelo, use outra chave de API');
        } else if (errType === 'HIGH_DEMAND') {
          setError('Alta demanda/ "modelo cansado": O modelo está sendo usado em fase de resfriamento, aguarde alguns segundos e tente novamente, ou troque o modelo');
        } else {
          setError('Opa, algo deu errado por aqui. Tente reformular sua ideia ou mude de modelo para que eu possa te ajudar melhor!');
        }
        setIsGenerating(false);
        return;
      }

      const aiMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.result
      };

      setSessions(prev => prev.map(s => {
        if (s.id === targetSessionId) {
          const existingCode = s.code || "";
          const parseResult = applyScriptEdits(existingCode, data.result);
          
          // Auto-open terminal if we just generated the first code block
          if (parseResult.updatedCode && !existingCode && parseResult.updatedCode.trim() !== "") {
            setIsTerminalOpen(true);
          }

          return { 
            ...s, 
            messages: [...s.messages, aiMessage],
            code: parseResult.updatedCode
          };
        }
        return s;
      }));
    } catch (error: any) {
      console.error(error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `*Erro:* ${error.message || 'Falha na conexão com o servidor.'}`
      };
      setSessions(prev => prev.map(s => {
        if (s.id === targetSessionId) {
          return { ...s, messages: [...s.messages, errorMessage] };
        }
        return s;
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopyCode = () => {
    const codeToCopy = currentSession?.code || '';
    if (!codeToCopy) return;
    navigator.clipboard.writeText(codeToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSaveCode = () => {
    if (!currentSessionId) return;
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return { ...s, code: editedCode };
      }
      return s;
    }));
    setIsEditingCode(false);
  };

  const stripCodeBlocks = (text: string) => {
    return text.replace(/```(?:lua|luau|[\s\S])*?```/gi, '').trim();
  };

  return (
    <div className="flex h-screen bg-neutral-950 overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-neutral-900 border-r border-neutral-800 transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col`}
      >
        <div className="p-4 flex items-center justify-between border-b border-neutral-800">
          <div className="flex items-center gap-2 text-neutral-300 font-medium">
            <TerminalSquare className="w-5 h-5 stroke-[1.5]" />
            <span className="text-sm tracking-wide">Luau Studio</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-md transition-colors"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg transition-colors border border-neutral-800"
          >
            <Plus className="w-4 h-4" />
            Novo Script
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
          {sessions.map(session => (
            <div 
              key={session.id}
              onClick={() => selectSession(session.id)}
              className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                currentSessionId === session.id 
                  ? 'bg-neutral-800 text-neutral-100' 
                  : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span className="text-sm truncate">{session.title}</span>
              </div>
              <button
                onClick={(e) => deleteSession(e, session.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-neutral-500 hover:text-red-400 transition-all shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative min-w-0">
        {/* Floating Controls (Removed bulky header bar for clean UI) */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <button
            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide uppercase border backdrop-blur-md transition-all shadow-md cursor-pointer ${
              isTerminalOpen 
                ? 'bg-neutral-800/90 border-neutral-700/80 text-neutral-100' 
                : 'bg-neutral-900/80 border-neutral-800/80 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700/60'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            Code
          </button>
        </div>

        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-4 left-4 z-20 p-2 bg-neutral-900/80 border border-neutral-800/80 backdrop-blur-md text-neutral-400 hover:text-neutral-200 rounded-lg transition-all shadow-md cursor-pointer"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto px-4 pt-16 pb-32">
          <div className="max-w-3xl mx-auto h-full">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-neutral-500 opacity-60">
                <TerminalSquare className="w-12 h-12 mb-4 stroke-[1.5]" />
                <p className="text-sm font-medium tracking-wide">Descreva o que deseja criar em Luau</p>
              </div>
            ) : (
              <div className="space-y-8 pb-8">
                {messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[85%] ${
                        msg.role === 'user' 
                          ? 'bg-neutral-900 text-neutral-100 px-5 py-3 rounded-2xl rounded-tr-sm' 
                          : 'text-neutral-300 w-full'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose w-full max-w-none prose-invert">
                          <Markdown>{stripCodeBlocks(msg.content)}</Markdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm md:text-base">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {isGenerating && (
                  <div className="flex justify-start">
                    <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="absolute bottom-32 left-0 right-0 px-4 z-50">
            <div className="max-w-3xl mx-auto bg-neutral-900/90 border border-red-500/30 p-4 rounded-xl flex items-start gap-3 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4">
              <div className="p-2 rounded-lg bg-red-500/10 shrink-0">
                <X className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-neutral-200 leading-relaxed font-medium">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-neutral-500 hover:text-neutral-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-neutral-950 via-neutral-950 to-transparent pt-10 pb-6 px-4">
          <div className="max-w-3xl mx-auto">
            <form 
              onSubmit={handleSubmit}
              className="relative flex flex-col bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden focus-within:border-neutral-700 transition-colors"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex: Crie um script de auto farm para blox fruits..."
                className="w-full max-h-[200px] bg-transparent text-neutral-200 placeholder:text-neutral-600 px-5 pt-4 pb-2 resize-none focus:outline-none text-sm md:text-base"
                rows={1}
              />
              <div className="flex items-center justify-between px-4 pb-3">
                <div className="flex items-center gap-3">
                  {/* Model Selector Dropdown */}
                  <div className="flex items-center gap-1.5 bg-neutral-950/40 px-2.5 py-1 rounded-lg border border-neutral-800/60">
                    <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">Model:</span>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="bg-transparent text-neutral-300 text-xs font-semibold focus:outline-none cursor-pointer pr-1"
                    >
                      <option value="gemini-3.5-flash" className="bg-neutral-900">Gemini 3.5 Flash</option>
                      <option value="gemini-3.1-pro-preview" className="bg-neutral-900">Gemini 3.1 Pro</option>
                      <option value="gemini-3-flash-preview" className="bg-neutral-900">Gemini 3 Flash</option>
                      <option value="gemini-flash-latest" className="bg-neutral-900">Gemini Latest</option>
                      <option value="gemini-3.1-flash-lite" className="bg-neutral-900">Gemini Flash Lite</option>
                    </select>
                  </div>

                  {/* Thinking Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setThinkingEnabled(!thinkingEnabled)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider border transition-all cursor-pointer ${
                      thinkingEnabled 
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20' 
                        : 'bg-neutral-950/40 border-neutral-800/60 text-neutral-500 hover:text-neutral-300 hover:border-neutral-700'
                    }`}
                    title={thinkingEnabled ? 'Desativar modo de raciocínio (Thinking)' : 'Ativar modo de raciocínio (Thinking)'}
                  >
                    <Brain className={`w-3.5 h-3.5 ${thinkingEnabled ? 'animate-pulse text-emerald-400' : ''}`} />
                    Thinking: {thinkingEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!input.trim() || isGenerating}
                  className="p-2 bg-neutral-850 hover:bg-neutral-800 text-neutral-300 disabled:opacity-40 rounded-xl transition-all flex items-center justify-center cursor-pointer"
                >
                  <SendHorizontal className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* Code Terminal Panel */}
      {isTerminalOpen && (
        <aside className="w-full md:w-[480px] lg:w-[580px] border-l border-neutral-800 bg-neutral-950 flex flex-col shrink-0 h-full relative z-30">
          {/* Terminal Header */}
          <div className="h-14 border-b border-neutral-800 flex items-center justify-between px-5 shrink-0">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-neutral-400" />
              <span className="text-xs font-semibold tracking-wider uppercase text-neutral-300">Script Terminal</span>
            </div>
            <button
              onClick={() => setIsTerminalOpen(false)}
              className="p-1 text-neutral-500 hover:text-neutral-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Utility Toolbar */}
          <div className="px-5 py-2.5 border-b border-neutral-900 bg-neutral-900/30 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
              {isEditingCode ? 'Modo de Edição' : 'Visualização'}
            </span>
            <div className="flex items-center gap-2">
              {currentSession?.code && (
                <>
                  {isEditingCode ? (
                    <button
                      onClick={handleSaveCode}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-850 hover:bg-neutral-800 text-[10px] font-bold uppercase text-neutral-200 transition-colors cursor-pointer"
                    >
                      <Save className="w-3 h-3" />
                      Salvar
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setEditedCode(currentSession.code || '');
                        setIsEditingCode(true);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded hover:bg-neutral-900 text-[10px] font-semibold uppercase text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      Editar
                    </button>
                  )}
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 px-2.5 py-1 rounded hover:bg-neutral-900 text-[10px] font-semibold uppercase text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-500">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copiar
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Terminal Code Display */}
          <div className="flex-1 overflow-hidden bg-black/40">
            {currentSession?.code ? (
              isEditingCode ? (
                <textarea
                  value={editedCode}
                  onChange={(e) => setEditedCode(e.target.value)}
                  className="w-full h-full bg-transparent text-emerald-500/80 font-mono text-sm p-6 focus:outline-none resize-none leading-relaxed overflow-y-auto selection:bg-emerald-500/20"
                  spellCheck={false}
                />
              ) : (
                <div className="h-full overflow-y-auto">
                  <SyntaxHighlighter
                    language="lua"
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      padding: '1.5rem',
                      background: 'transparent',
                      fontSize: '0.875rem',
                      lineHeight: '1.6',
                    }}
                  >
                    {currentSession.code}
                  </SyntaxHighlighter>
                </div>
              )
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-neutral-600 font-mono text-xs text-center px-4">
                <TerminalSquare className="w-8 h-8 mb-3 stroke-[1.2] opacity-40" />
                <p className="max-w-[240px] leading-relaxed">
                  [SYSTEM]: Terminal pronto. Solicite um script Luau no chat para exibir o código aqui.
                </p>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
