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
  Brain,
  Settings,
  Key,
  ShieldCheck,
  Sparkles,
  MoreHorizontal,
  ChevronRight
} from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
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
  
  // Navigation
  const [currentView, setCurrentView] = useState<'chat' | 'settings'>('chat');
  const [userApiKey, setUserApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');
  const [tempApiKey, setTempApiKey] = useState(userApiKey);

  // Input Menu States
  const [isInputMenuOpen, setIsInputMenuOpen] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  
  const [showTaskCompleted, setShowTaskCompleted] = useState(false);
  
  // Terminal/Code view states
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editedCode, setEditedCode] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId) || null;
  const messages = currentSession?.messages || [];

  // Sync editedCode when currentSession changes
  useEffect(() => {
    setEditedCode(currentSession?.code || '');
  }, [currentSessionId, currentSession?.code]);

  const scrollToBottom = (instant = false) => {
    const config: ScrollIntoViewOptions = { behavior: instant ? 'auto' : 'smooth', block: 'end' };
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView(config);
    if (terminalEndRef.current) terminalEndRef.current.scrollIntoView(config);
  };

  useEffect(() => {
    scrollToBottom(isGenerating);
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
    setCurrentView('chat'); // Switch back to chat when selecting a session
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
    setShowTaskCompleted(false);

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
      let aiResultText = '';

      if (userApiKey && userApiKey.trim() !== '') {
        // Direct Client-Side Gemini API Call
        const modelMapping: { [key: string]: string } = {
          'gemini-3.5-flash': 'gemini-2.5-flash',
          'gemini-3.1-pro-preview': 'gemini-2.5-pro',
          'gemini-3-flash-preview': 'gemini-2.5-flash',
          'gemini-flash-latest': 'gemini-2.5-flash',
          'gemini-3.1-flash-lite': 'gemini-2.5-flash',
        };

        const actualModel = modelMapping[selectedModel] || selectedModel || 'gemini-2.5-flash';

        const contents = targetMessages.map(msg => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }]
        }));

        const systemInstructionText = `Você é Hoy 0.2 beta, um assistente de elite especializado em Luau e Roblox Studio.

SEU FLUXO OBRIGATÓRIO:
1. Comece com uma saudação breve (MÁXIMO 1 frase). Ex: "Olá! Vou ajustar o sistema de pulo para você."
2. NUNCA use blocos de código markdown (\`\`\`) para explicar nada ou mostrar código no chat.
3. Se o script já existe, use o formato [SEARCH]/[EDIT]/[END] para modificar.
4. Se for um script NOVO, use APENAS UM bloco de código Luau: \`\`\`lua ... \`\`\`.
5. NUNCA coloque código ou os marcadores [SEARCH]/[EDIT]/[END] fora de sua função técnica. Eles NÃO devem aparecer no chat para o usuário.
6. TODA sua resposta de chat deve ser apenas texto puro, sem formatação de código markdown (\`\`\`). Se precisar dar um exemplo, descreva-o em texto ou use o formato de edição técnica.

REGRAS DE FORMATAÇÃO:
- [SEARCH]: Deve conter as linhas EXATAS que você quer substituir.
- [EDIT]: Deve conter o novo código.
- [END]: Marca o fim da edição.

REGRAS CRÍTICAS DE CÓDIGO:
- Use 'game:GetService()' para localizar serviços.
- Use 'task.wait()' em vez de 'wait()'.
- Use variáveis locais.
- Se for script de executor: use getgenv, firetouchinterest, hookmetamethod, etc.

Mantenha o texto do chat limpo, sem fragmentos de código e focado em ser um assistente direto.`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${userApiKey}`;

        const requestBody: any = {
          contents,
          systemInstruction: {
            parts: [{ text: systemInstructionText }]
          },
          generationConfig: {
            temperature: 0.1
          }
        };

        if (thinkingEnabled && actualModel.includes("gemini")) {
          requestBody.generationConfig.thinkingConfig = {
            thinkingBudget: 1024
          };
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `Erro ${res.status}: ${res.statusText}`;
          throw new Error(errMsg);
        }

        const resData = await res.json();
        const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error("A API do Gemini não retornou texto.");
        }
        aiResultText = text;

      } else {
        // Fallback to Server API /api/generate
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            messages: targetMessages, 
            selectedModel, 
            thinkingEnabled,
            userApiKey: '' 
          })
        });

        if (!response.ok) {
          let errType = '';
          try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const data = await response.json();
              errType = data.error || data.message;
            } else {
              const textResponse = await response.text();
              if (textResponse.trim().startsWith('<')) {
                throw new Error("HTML_RESPONSE");
              }
            }
          } catch (e: any) {
            if (e.message === "HTML_RESPONSE" || response.status === 404) {
              throw new Error("Aviso de Hospedagem Estática");
            }
          }

          if (errType === 'QUOTA_EXHAUSTED') {
            setError('Cota excedida: A cota do modelo está esgotada, troque o modelo ou use sua própria chave de API nas configurações.');
          } else if (errType === 'HIGH_DEMAND') {
            setError('Alta demanda: O modelo está sendo usado em fase de resfriamento, aguarde alguns segundos e tente novamente, ou use sua própria chave de API nas configurações.');
          } else {
            setError('Opa, algo deu errado por aqui. Tente reformular sua ideia ou use sua própria chave de API nas configurações!');
          }
          setIsGenerating(false);
          return;
        }

        let data;
        try {
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const textResponse = await response.text();
            if (textResponse.trim().startsWith('<')) {
              throw new Error("HTML_RESPONSE");
            }
            throw new Error("NOT_JSON");
          }
          data = await response.json();
        } catch (jsonErr: any) {
          if (jsonErr.message === "HTML_RESPONSE" || response.status === 404) {
            throw new Error("Aviso de Hospedagem Estática");
          } else {
            throw new Error("O servidor não respondeu com um formato JSON válido.");
          }
        }

        aiResultText = data.result;
      }

      const aiMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: aiResultText
      };

      setSessions(prev => prev.map(s => {
        if (s.id === targetSessionId) {
          const existingCode = s.code || "";
          const parseResult = applyScriptEdits(existingCode, aiResultText);
          
          // Auto-open terminal if we just generated code
          if (aiResultText.includes('```') || aiResultText.includes('[SEARCH]')) {
            setIsTerminalOpen(true);
          }

          // Show task completion signal if code was generated or modified
          if (aiResultText.includes('```')) {
            setShowTaskCompleted(true);
            setTimeout(() => setShowTaskCompleted(false), 5000);
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
      let contentMessage = `*Erro:* ${error.message || 'Falha na conexão com o servidor.'}`;
      if (error.message === "Aviso de Hospedagem Estática") {
        contentMessage = `⚠️ **Aviso de Hospedagem Estática**
Como o aplicativo está hospedado como um site estático (Vercel, Netlify, etc), o servidor backend não está ativo para processar as requisições gratuitamente.

**Para continuar usando Hoy 0.2 de forma 100% gratuita:**
1. Clique no ícone de **Engrenagem** ⚙️ no canto inferior esquerdo.
2. Insira sua própria chave Gemini API gratuita (fornecemos o link direto para você gerar sua chave do AI Studio na mesma página).
3. Clique em **Salvar Chaves**.

Pronto! O aplicativo passará a fazer conexões diretas e rápidas sem depender de servidor nenhum.`;
      }
      
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: contentMessage
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

  const saveApiKey = () => {
    localStorage.setItem('gemini_api_key', tempApiKey);
    setUserApiKey(tempApiKey);
    setCurrentView('chat');
  };

  const stripCodeBlocks = (text: string) => {
    if (!text) return '';
    // Remove [SEARCH]/[EDIT]/[END] blocks (even partial ones during streaming)
    let cleanText = text.replace(/\[SEARCH\][\s\S]*?(\[END\]|$)/gi, '');
    // Remove standard code blocks (even partial ones during streaming)
    cleanText = cleanText.replace(/```(?:lua|luau)?[\s\S]*?(```|$)/gi, '');
    return cleanText.trim();
  };

  return (
    <div className="flex h-screen bg-black overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-black transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col`}
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-white">Hoy AI</span>
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-[0.2em]">0.2 beta</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 rounded-md transition-colors"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-black text-black bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-[0_0_25px_rgba(52,211,153,0.3)] active:scale-[0.98] uppercase tracking-wider"
          >
            <Plus className="w-5 h-5 stroke-[3.5]" />
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

        <div className="p-3 bg-black">
          <button
            onClick={() => {
              setCurrentView('settings');
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
              currentView === 'settings' 
                ? 'bg-black text-neutral-100' 
                : 'text-neutral-400 hover:text-neutral-100 hover:bg-black'
            }`}
          >
            <Settings className="w-4 h-4" />
            Configurações
          </button>
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
        {/* Main Content */}
        {currentView === 'chat' ? (
          <>
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
              <button
                onClick={() => setIsTerminalOpen(!isTerminalOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide uppercase border backdrop-blur-md transition-all shadow-md cursor-pointer ${
                  isTerminalOpen 
                    ? 'bg-black/90 border-neutral-700/80 text-neutral-100' 
                    : 'bg-black/80 border-neutral-800/80 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700/60'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                Code
              </button>
            </div>

            {!isSidebarOpen && (
              <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 bg-black/80 border border-neutral-800/80 backdrop-blur-md text-neutral-400 hover:text-neutral-200 rounded-lg transition-all shadow-md cursor-pointer"
                >
                  <PanelLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-full border border-neutral-800/50 backdrop-blur-sm">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-[9px] font-bold text-emerald-500/90 uppercase tracking-tight">BETA test</span>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 md:px-10 lg:px-20 pt-16 pb-40">
              <div className="max-w-3xl mx-auto h-full">
                {!userApiKey && (
                  <div className="mb-8 p-6 bg-black border border-neutral-800 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-4">
                    <div className="p-2.5 bg-neutral-850 rounded-xl text-neutral-400">
                      <Key className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <p className="text-neutral-300 text-sm leading-relaxed mb-4">
                        Por favor adicione uma chave em configurações, para que Hoy possa funcionar normalmente.
                      </p>
                      <button 
                        onClick={() => setCurrentView('settings')}
                        className="px-4 py-2 bg-neutral-100 text-neutral-950 text-xs font-bold rounded-lg hover:bg-white transition-colors uppercase tracking-wider"
                      >
                        Configurações
                      </button>
                    </div>
                  </div>
                )}

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
                        className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-6`}
                      >
                            <div 
                              className={`max-w-[92%] sm:max-w-[85%] border border-neutral-800/60 rounded-2xl ${
                                msg.role === 'user' 
                                  ? 'bg-black text-neutral-100 px-5 py-3 rounded-tr-sm' 
                                  : 'bg-black text-neutral-300 px-6 py-5 w-full'
                              }`}
                            >
                              {msg.role === 'assistant' ? (
                                <div className="prose w-full max-w-none prose-invert break-words">
                                  <Markdown>{stripCodeBlocks(msg.content)}</Markdown>
                                </div>
                              ) : (
                                <p className="whitespace-pre-wrap text-sm md:text-base break-words">{msg.content}</p>
                              )}
                            </div>
                      </div>
                    ))}
                    {isGenerating && (
                      <div className="flex justify-start py-4">
                        <span className="text-sm font-medium shimmer-text opacity-80">
                          Thinking...
                        </span>
                      </div>
                    )}

                    <AnimatePresence>
                      {showTaskCompleted && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-3 py-4 my-4"
                        >
                          <div className="p-1.5 bg-emerald-500/10 rounded-full">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                          </div>
                          <span className="text-sm font-bold text-white tracking-widest uppercase glow-text px-1">
                            Task Completed
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div ref={messagesEndRef} className="h-32" />
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="absolute bottom-32 left-0 right-0 px-4 z-50">
                <div className="max-w-3xl mx-auto bg-black border border-red-500/30 p-4 rounded-xl flex items-start gap-3 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4">
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
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent pt-12 pb-6 px-4 pointer-events-none">
              <div className="max-w-3xl mx-auto pointer-events-auto">
                <form 
                  onSubmit={handleSubmit}
                  className="relative flex flex-col bg-black border-2 border-neutral-700 rounded-[32px] overflow-visible focus-within:border-neutral-500 transition-all shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]"
                >
                  <div className="relative">
                    {!input && (
                      <div className="absolute left-14 top-[15px] pointer-events-none text-sm md:text-base leading-relaxed shimmer-text font-medium opacity-40 select-none">
                        Ask for scripting...
                      </div>
                    )}
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="w-full min-h-[52px] max-h-[180px] bg-transparent text-neutral-200 placeholder:text-transparent px-14 pt-3.5 pb-3.5 resize-none focus:outline-none text-sm md:text-base leading-relaxed"
                      rows={1}
                    />
                    
                    {/* Left "..." Menu Button */}
                    <div className="absolute left-2.5 top-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsInputMenuOpen(!isInputMenuOpen);
                          setIsModelMenuOpen(false);
                        }}
                        className={`p-1.5 rounded-full transition-all border cursor-pointer ${
                          isInputMenuOpen ? 'bg-black border-neutral-700 text-neutral-100' : 'border-transparent text-neutral-600 hover:text-neutral-400 hover:bg-black'
                        }`}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu */}
                      <AnimatePresence>
                        {isInputMenuOpen && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute bottom-full left-0 mb-3 bg-black border border-neutral-800 rounded-2xl p-1.5 shadow-2xl min-w-[160px] z-50 backdrop-blur-xl"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setThinkingEnabled(!thinkingEnabled);
                                setIsInputMenuOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                                thinkingEnabled 
                                  ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' 
                                  : 'bg-black border-transparent text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <Brain className={`w-4 h-4 ${thinkingEnabled ? 'animate-pulse' : ''}`} />
                                Thinking Mode
                              </div>
                              <div className={`w-1.5 h-1.5 rounded-full ${thinkingEnabled ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-neutral-700'}`} />
                            </button>

                            <div className="relative group">
                              <button
                                type="button"
                                onMouseEnter={() => setIsModelMenuOpen(true)}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200 ${isModelMenuOpen ? 'bg-neutral-900 border-neutral-800 text-neutral-200' : 'border-transparent'}`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <Sparkles className="w-4 h-4" />
                                  Model Engine
                                </div>
                                <ChevronRight className="w-3 h-3 opacity-50" />
                              </button>

                              <AnimatePresence>
                                {isModelMenuOpen && (
                                  <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    onMouseLeave={() => setIsModelMenuOpen(false)}
                                    className="absolute bottom-0 left-full ml-3 bg-black border border-neutral-800 rounded-2xl p-1.5 shadow-2xl min-w-[130px] backdrop-blur-xl"
                                  >
                                    {[
                                      { id: 'gemini-3.5-flash', label: '3.5 Flash' },
                                      { id: 'gemini-3.1-pro-preview', label: '3.1 Pro' },
                                      { id: 'gemini-3-flash-preview', label: '3 Flash' },
                                      { id: 'gemini-flash-latest', label: 'Latest' },
                                      { id: 'gemini-3.1-flash-lite', label: 'Lite' }
                                    ].map((m) => (
                                      <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => {
                                          setSelectedModel(m.id);
                                          setIsModelMenuOpen(false);
                                          setIsInputMenuOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${
                                          selectedModel === m.id 
                                            ? 'bg-neutral-800 text-neutral-100' 
                                            : 'text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300'
                                        }`}
                                      >
                                        {m.label}
                                      </button>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Right Send Button */}
                    <div className="absolute right-2.5 top-2.5">
                      <button
                        type="submit"
                        disabled={!input.trim() || isGenerating}
                        className="p-1.5 bg-neutral-100 hover:bg-white text-neutral-950 disabled:opacity-20 rounded-full transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
                      >
                        <SendHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 pt-16 pb-32">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="absolute top-4 left-4 z-20 p-2 bg-black border border-neutral-800 backdrop-blur-md text-neutral-400 hover:text-neutral-200 rounded-lg transition-all shadow-md cursor-pointer"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}
            <div className="max-w-xl mx-auto">
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-neutral-100 mb-2">Motor da Hoy</h1>
                <p className="text-neutral-500 text-sm">Gerencie suas chaves de API e preferências do motor de inteligência.</p>
              </div>

              <div className="bg-black border border-neutral-800 rounded-2xl p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest ml-1">
                    Chave Gemini API
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Key className="w-4 h-4 text-neutral-600 group-focus-within:text-neutral-400 transition-colors" />
                    </div>
                    <input
                      type="password"
                      value={tempApiKey}
                      onChange={(e) => setTempApiKey(e.target.value)}
                      placeholder="Adicione sua chave gmini!"
                      className="w-full bg-black border border-neutral-800 rounded-xl py-3 pl-11 pr-4 text-neutral-200 placeholder:text-neutral-700 focus:outline-none focus:border-neutral-600 transition-all text-sm"
                    />
                  </div>
                  <p className="text-[10px] text-neutral-600 ml-1 leading-relaxed">
                    Sua chave é armazenada localmente no navegador e nunca é salva em nossos servidores permanentes.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={saveApiKey}
                    className="w-full py-3 bg-neutral-100 hover:bg-white text-neutral-950 font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-[0.98]"
                  >
                    <Save className="w-4 h-4" />
                    Salvar Chaves
                  </button>
                  
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noreferrer"
                    className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Obter Chave API (AI Studio)
                  </a>
                </div>
              </div>

              <button
                onClick={() => setCurrentView('chat')}
                className="mt-6 w-full py-3 text-neutral-500 hover:text-neutral-300 text-sm font-medium transition-colors"
              >
                Voltar para o Chat
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Code Terminal Panel */}
      {isTerminalOpen && (
        <aside className="w-full md:w-[480px] lg:w-[580px] bg-black flex flex-col shrink-0 h-full relative z-30">
          {/* Terminal Header */}
          <div className="h-14 flex items-center justify-between px-5 shrink-0">
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
          <div className="px-5 py-2.5 bg-black flex items-center justify-between shrink-0">
            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
              {isEditingCode ? 'Modo de Edição' : 'Visualização'}
            </span>
            <div className="flex items-center gap-2">
              {currentSession?.code && (
                <>
                  {isEditingCode ? (
                    <button
                      onClick={handleSaveCode}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-black hover:bg-neutral-900 text-[10px] font-bold uppercase text-neutral-200 transition-colors cursor-pointer"
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
                  <div ref={terminalEndRef} className="h-32" />
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
