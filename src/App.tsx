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
  ChevronRight,
  Camera,
  Image as ImageIcon,
  FileText,
  Search,
  Download,
  Paperclip,
  Share2,
  Clipboard,
  ShieldAlert,
  Globe,
  Smartphone,
  DownloadCloud
} from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message, ChatSession, Attachment, PastedContent } from './types';
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
  
  // Attachment & Pasted Content States
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [pendingPastedContents, setPendingPastedContents] = useState<PastedContent[]>([]);

  // Camera Modal/View State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Web Search Panel State
  const [isWebSearchActive, setIsWebSearchActive] = useState(false);
  const [webSearchQuery, setWebSearchQuery] = useState('');
  const [webSearchResults, setWebSearchResults] = useState<any[]>([]);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);

  // Viewer Modal State
  const [viewingItem, setViewingItem] = useState<{ title: string; content: string; extension: string } | null>(null);
  const [viewerCopied, setViewerCopied] = useState(false);

  // Refs for files and hardware
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
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

  // Extension styling configuration
  const extensionConfig: { [key: string]: { label: string; color: string; bg: string } } = {
    lua: { label: 'LUA', color: 'text-sky-400 border-sky-500/20', bg: 'bg-sky-500/10' },
    txt: { label: 'TXT', color: 'text-neutral-400 border-neutral-500/20', bg: 'bg-neutral-500/10' },
    json: { label: 'JSON', color: 'text-amber-400 border-amber-500/20', bg: 'bg-amber-500/10' },
    js: { label: 'JS', color: 'text-yellow-400 border-yellow-500/20', bg: 'bg-yellow-500/10' },
    ts: { label: 'TS', color: 'text-blue-400 border-blue-500/20', bg: 'bg-blue-500/10' },
    py: { label: 'PY', color: 'text-indigo-400 border-indigo-500/20', bg: 'bg-indigo-500/10' },
    html: { label: 'HTML', color: 'text-orange-400 border-orange-500/20', bg: 'bg-orange-500/10' },
    css: { label: 'CSS', color: 'text-pink-400 border-pink-500/20', bg: 'bg-pink-500/10' },
    md: { label: 'MD', color: 'text-teal-400 border-teal-500/20', bg: 'bg-teal-500/10' },
    xml: { label: 'XML', color: 'text-purple-400 border-purple-500/20', bg: 'bg-purple-500/10' },
    yaml: { label: 'YAML', color: 'text-lime-400 border-lime-500/20', bg: 'bg-lime-500/10' },
    pdf: { label: 'PDF', color: 'text-rose-400 border-rose-500/20', bg: 'bg-rose-500/10' },
    zip: { label: 'ZIP', color: 'text-fuchsia-400 border-fuchsia-500/20', bg: 'bg-fuchsia-500/10' },
    png: { label: 'IMG', color: 'text-emerald-400 border-emerald-500/20', bg: 'bg-emerald-500/10' },
    jpg: { label: 'IMG', color: 'text-emerald-400 border-emerald-500/20', bg: 'bg-emerald-500/10' },
    jpeg: { label: 'IMG', color: 'text-emerald-400 border-emerald-500/20', bg: 'bg-emerald-500/10' },
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    const lines = text.split(/\r?\n/);
    if (lines.length > 100) {
      e.preventDefault();
      const newPasted: PastedContent = {
        title: `Conteúdo colado (${lines.length} linhas)`,
        extension: 'txt',
        content: text,
        lineCount: lines.length
      };
      setPendingPastedContents(prev => [...prev, newPasted]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      const extension = file.name.split('.').pop()?.toLowerCase() || 'txt';
      
      reader.onload = (event) => {
        const content = event.target?.result as string;
        
        // Convert large text files (>100 lines) into a pasted content card
        if (type === 'file' && !['pdf', 'zip'].includes(extension)) {
          const lines = content.split(/\r?\n/);
          if (lines.length > 100) {
            const newPasted: PastedContent = {
              title: file.name,
              extension,
              content,
              lineCount: lines.length
            };
            setPendingPastedContents(prev => [...prev, newPasted]);
            return;
          }
        }

        const newAttachment: Attachment = {
          name: file.name,
          extension,
          size: formatBytes(file.size),
          content
        };
        
        setPendingAttachments(prev => [...prev, newAttachment]);
      };
      
      if (type === 'image' || ['pdf', 'zip'].includes(extension)) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
    
    e.target.value = '';
  };

  // Camera stream controllers
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn("Could not start camera, using simulation", err);
      setCameraError("Câmera bloqueada ou indisponível. Usando o simulador de capturas da Hoy.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  useEffect(() => {
    if (isCameraActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isCameraActive]);

  const capturePhoto = () => {
    if (cameraStream && videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        const filename = `camera_shot_${Date.now()}.png`;
        
        const sizeInBytes = Math.round((dataUrl.length - 22) * 3 / 4);
        
        const newAttachment: Attachment = {
          name: filename,
          extension: 'png',
          size: formatBytes(sizeInBytes),
          content: dataUrl
        };
        
        setPendingAttachments(prev => [...prev, newAttachment]);
        setIsCameraActive(false);
      }
    } else {
      // Simulation backup if webcam blocked or unavailable
      const simulations = [
        { name: "roblox_jump_glitch_diagnostics.png" },
        { name: "studio_explorer_hierarchy.png" },
        { name: "executor_error_log.png" }
      ];
      const selectedSim = simulations[Math.floor(Math.random() * simulations.length)];
      const dummyBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      
      const newAttachment: Attachment = {
        name: selectedSim.name,
        extension: 'png',
        size: "142 KB",
        content: dummyBase64
      };
      setPendingAttachments(prev => [...prev, newAttachment]);
      setIsCameraActive(false);
    }
  };

  // Web search controllers
  const handleWebSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!webSearchQuery.trim()) return;
    
    setIsSearchingWeb(true);
    setTimeout(() => {
      const mockResults = [
        {
          title: `Roblox API - ${webSearchQuery}`,
          url: `https://create.roblox.com/docs/reference/engine/classes/${webSearchQuery.replace(/\s+/g, '')}`,
          snippet: `Guia oficial do Roblox Creator Hub para ${webSearchQuery}. Detalhes de eventos, propriedades, métodos e boas práticas de integração em sistemas Luau.`
        },
        {
          title: `Guia de Otimização: ${webSearchQuery}`,
          url: `https://luau-lang.org/library#${webSearchQuery.toLowerCase().replace(/\s+/g, '-')}`,
          snippet: `Como estruturar ${webSearchQuery} de forma performática. Exemplos de vazamentos de memória comuns, task.spawn e otimização no Roblox Studio.`
        },
        {
          title: `Roblox DevForum - Dicas para ${webSearchQuery}`,
          url: "https://devforum.roblox.com/t/how-to-solve-jump-issues",
          snippet: "Tópico da comunidade discutindo as melhores soluções de scripting, getgenv e hookmetamethod para desenvolvedores avançados."
        }
      ];
      setWebSearchResults(mockResults);
      setIsSearchingWeb(false);
    }, 1000);
  };

  const attachWebResult = (result: any) => {
    const documentContent = `--- RESULTADO DE BUSCA NA WEB ---
Título: ${result.title}
URL: ${result.url}
Resumo: ${result.snippet}

--- CONTEXTO ADICIONAL PARA HOY ---
Sempre que o usuário solicitar algo relacionado a este tópico, use esta referência oficial da documentação para embasar suas edições em Luau de forma moderna e performática.`;

    const filename = `pesquisa_${webSearchQuery.toLowerCase().trim().replace(/\s+/g, '_')}.txt`;
    
    const newAttachment: Attachment = {
      name: filename,
      extension: 'txt',
      size: formatBytes(new Blob([documentContent]).size),
      content: documentContent
    };
    
    setPendingAttachments(prev => [...prev, newAttachment]);
    setIsWebSearchActive(false);
    setWebSearchQuery('');
    setWebSearchResults([]);
  };

  const parseResponseAttachments = (text: string, userPrompt: string): {
    cleanContent: string;
    attachments: Attachment[];
    pastedContents: PastedContent[];
  } => {
    const attachments: Attachment[] = [];
    const pastedContents: PastedContent[] = [];
    let cleanContent = text;

    const promptLower = userPrompt.toLowerCase();
    const wantsFileKeywords = [
      'arquivo', 'arquivos', 'file', 'files', '.lua', '.txt', '.json', '.js', '.ts', 
      '.py', '.html', '.css', '.md', '.xml', '.yaml', '.pdf', '.zip', 'mande em', 
      'envie em', 'download', 'baixar', 'gere um', 'salve em'
    ];
    const userWantsFile = wantsFileKeywords.some(keyword => promptLower.includes(keyword));

    const codeBlockRegex = /```(\w*)\s*([\w\-.]*)\r?\n([\s\S]*?)```/g;
    let match;
    const blocks: { language: string; filename: string; content: string; fullMatch: string }[] = [];

    while ((match = codeBlockRegex.exec(text)) !== null) {
      blocks.push({
        language: match[1]?.toLowerCase() || 'lua',
        filename: match[2] || '',
        content: match[3],
        fullMatch: match[0]
      });
    }

    if (blocks.length > 0) {
      blocks.forEach((block, idx) => {
        const lineCount = block.content.split(/\r?\n/).length;
        let ext = block.language || 'lua';
        if (ext === 'luau') ext = 'lua';
        if (ext === 'javascript') ext = 'js';
        if (ext === 'typescript') ext = 'ts';
        if (ext === 'python') ext = 'py';
        if (ext === 'markdown') ext = 'md';

        let filename = block.filename;
        if (!filename) {
          if (blocks.length === 1) {
            filename = `script.${ext}`;
          } else {
            filename = `modulo_${idx + 1}.${ext}`;
          }
        }

        if (userWantsFile || lineCount > 40) {
          attachments.push({
            name: filename,
            extension: ext,
            size: formatBytes(new Blob([block.content]).size),
            content: block.content
          });
          cleanContent = cleanContent.replace(block.fullMatch, `\n\n📄 **[Arquivo Gerado: ${filename}]** *(Disponível para download abaixo)*\n\n`);
        } else if (lineCount > 100) {
          pastedContents.push({
            title: `Script completo (${lineCount} linhas)`,
            extension: ext,
            content: block.content,
            lineCount
          });
          cleanContent = cleanContent.replace(block.fullMatch, `\n\n📝 **[Conteúdo Colado: ${filename}]** *(Toque no cartão abaixo para abrir)*\n\n`);
        }
      });
    }

    const totalLines = cleanContent.split(/\r?\n/).length;
    if (totalLines > 100) {
      pastedContents.push({
        title: 'Explicação detalhada',
        extension: 'txt',
        content: cleanContent,
        lineCount: totalLines
      });
      cleanContent = "📝 **Conteúdo extenso gerado pela IA.** *(Toque no cartão de Conteúdo Colado abaixo para visualizar na íntegra)*";
    }

    return {
      cleanContent,
      attachments,
      pastedContents
    };
  };

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
    if ((!input.trim() && pendingAttachments.length === 0 && pendingPastedContents.length === 0) || isGenerating) return;

    let userContent = input.trim();
    if (!userContent) {
      const labelParts = [];
      if (pendingAttachments.length > 0) labelParts.push(`[${pendingAttachments.length} arquivo(s) anexado(s)]`);
      if (pendingPastedContents.length > 0) labelParts.push(`[${pendingPastedContents.length} conteúdo(s) colado(s)]`);
      userContent = labelParts.join(' e ');
    }

    setInput('');
    setIsGenerating(true);
    setShowTaskCompleted(false);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userContent,
      attachments: pendingAttachments.length > 0 ? [...pendingAttachments] : undefined,
      pastedContents: pendingPastedContents.length > 0 ? [...pendingPastedContents] : undefined
    };

    setPendingAttachments([]);
    setPendingPastedContents([]);

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
        const actualModel = selectedModel || 'gemini-3.5-flash';

        const contents = targetMessages.map(msg => {
          let combinedText = msg.content || "";
          
          const textAttachments = msg.attachments?.filter((a: any) => !a.content.startsWith('data:image/')) || [];
          const pastedContents = msg.pastedContents || [];
          
          if (textAttachments.length > 0 || pastedContents.length > 0) {
            combinedText += "\n\n[Arquivos Anexados / Conteúdo Colado pelo Usuário:]";
            textAttachments.forEach((att: any) => {
              combinedText += `\n\n--- ARQUIVO: ${att.name} (${att.size}) ---\n${att.content}\n-----------------------------------------`;
            });
            pastedContents.forEach((past: any) => {
              combinedText += `\n\n--- CONTEÚDO COLADO: ${past.title} (${past.lineCount} linhas) ---\n${past.content}\n-----------------------------------------`;
            });
          }
          
          const parts: any[] = [{ text: combinedText }];
          
          // Add images if present
          const imageAttachments = msg.attachments?.filter((a: any) => a.content.startsWith('data:image/')) || [];
          imageAttachments.forEach((att: any) => {
            const match = att.content.match(/^data:([^;]+);base64,(.*)$/);
            if (match) {
              parts.push({
                inlineData: {
                  mimeType: match[1],
                  data: match[2]
                }
              });
            }
          });
          
          return {
            role: msg.role === "user" ? "user" : "model",
            parts
          };
        });

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

      const totalLines = aiResultText.split(/\r?\n/).length;
      const preferredMode = detectUserPreferredMode(userContent);

      let aiMessage: Message;

      if (totalLines > 100 && preferredMode === null) {
        // Needs user decision!
        aiMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '',
          pendingDecision: {
            rawText: aiResultText,
            userPrompt: userContent
          }
        };
      } else {
        const modeToUse = preferredMode || 'files';
        
        if (modeToUse === 'chat') {
          aiMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: aiResultText,
            hasSelectedChatMode: true
          };
        } else {
          const parsedRes = parseResponseAttachments(aiResultText, userContent);
          aiMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: parsedRes.cleanContent,
            attachments: parsedRes.attachments.length > 0 ? parsedRes.attachments : undefined,
            pastedContents: parsedRes.pastedContents.length > 0 ? parsedRes.pastedContents : undefined
          };
        }
      }

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

  const detectUserPreferredMode = (prompt: string): 'files' | 'chat' | null => {
    const text = prompt.toLowerCase();
    
    // File preferences keywords
    const fileKeywords = [
      'me mande em files',
      'envie como texto colado',
      'mande em files',
      'manda em files',
      'como texto colado',
      'texto colado',
      'enviar em files',
      'mandar em files',
      'salvar em files'
    ];
    
    // Chat preferences keywords
    const chatKeywords = [
      'manda no chat',
      'mande no chat',
      'não envie em files',
      'na conversa',
      'direto no chat',
      'no chat mesmo',
      'não mandar em files',
      'sem files',
      'não mande em files',
      'não use files'
    ];
    
    if (fileKeywords.some(kw => text.includes(kw))) {
      return 'files';
    }
    if (chatKeywords.some(kw => text.includes(kw))) {
      return 'chat';
    }
    
    return null;
  };

  const handleResolveMessageDecision = (messageId: string, mode: 'files' | 'chat') => {
    setSessions(prev => prev.map(s => {
      const msgIndex = s.messages.findIndex(m => m.id === messageId);
      if (msgIndex === -1) return s;
      
      const updatedMessages = [...s.messages];
      const targetMsg = updatedMessages[msgIndex];
      if (!targetMsg.pendingDecision) return s;
      
      const { rawText, userPrompt } = targetMsg.pendingDecision;
      
      let finalContent = "";
      let finalAttachments: Attachment[] | undefined = undefined;
      let finalPastedContents: PastedContent[] | undefined = undefined;
      let hasSelectedChatMode = false;
      
      if (mode === 'files') {
        const parsedRes = parseResponseAttachments(rawText, userPrompt);
        finalContent = parsedRes.cleanContent;
        finalAttachments = parsedRes.attachments.length > 0 ? parsedRes.attachments : undefined;
        finalPastedContents = parsedRes.pastedContents.length > 0 ? parsedRes.pastedContents : undefined;
      } else {
        // 'chat' mode
        finalContent = rawText;
        hasSelectedChatMode = true;
      }
      
      updatedMessages[msgIndex] = {
        ...targetMsg,
        content: finalContent,
        attachments: finalAttachments,
        pastedContents: finalPastedContents,
        pendingDecision: undefined,
        hasSelectedChatMode
      };
      
      return {
        ...s,
        messages: updatedMessages
      };
    }));
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

        <div className="p-3 bg-black flex flex-col gap-1.5 border-t border-neutral-900">
          <a
            href="https://hoy-0-1.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-neutral-400 hover:text-rose-400 hover:bg-neutral-950 rounded-lg transition-all"
          >
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-rose-500" />
              <span>Download APK</span>
            </div>
            <DownloadCloud className="w-3.5 h-3.5 opacity-65" />
          </a>

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
                                msg.pendingDecision ? (
                                  <div className="flex flex-col gap-4">
                                    <div className="flex items-center gap-2.5 text-amber-400">
                                      <FileText className="w-5 h-5 animate-pulse text-amber-500" />
                                      <span className="text-sm font-bold uppercase tracking-wider">Conteúdo Extenso Gerado ({msg.pendingDecision.rawText.split(/\r?\n/).length} linhas)</span>
                                    </div>
                                    <p className="text-xs text-neutral-400 leading-relaxed">
                                      Esta resposta é muito grande para o layout padrão do chat. Escolha como gostaria de recebê-la nesta mensagem:
                                    </p>

                                    {/* Mini preview */}
                                    <div className="relative max-h-36 overflow-hidden rounded-xl bg-neutral-950 border border-neutral-900 p-3.5 font-mono text-[11px] text-neutral-500 select-none">
                                      <pre className="overflow-hidden">
                                        {msg.pendingDecision.rawText.split(/\r?\n/).slice(0, 8).join('\n')}
                                        {msg.pendingDecision.rawText.split(/\r?\n/).length > 8 && "\n..."}
                                      </pre>
                                      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-neutral-950 to-transparent pointer-events-none" />
                                    </div>

                                    {/* Option cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleResolveMessageDecision(msg.id, 'files')}
                                        className="flex flex-col items-start gap-2 p-4 bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700/80 rounded-2xl text-left transition-all hover:scale-[1.01] active:scale-[0.99] group cursor-pointer"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400 group-hover:bg-amber-500 group-hover:text-black transition-colors">
                                            <Clipboard className="w-4 h-4" />
                                          </div>
                                          <span className="text-xs font-bold text-neutral-200 group-hover:text-white transition-colors">Enviar em files (Texto colado)</span>
                                        </div>
                                        <p className="text-[11px] text-neutral-450 leading-normal">
                                          Converte em um cartão de Conteúdo colado, mantendo a conversa organizada. Toque no cartão para abrir, copiar ou compartilhar.
                                        </p>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleResolveMessageDecision(msg.id, 'chat')}
                                        className="flex flex-col items-start gap-2 p-4 bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700/80 rounded-2xl text-left transition-all hover:scale-[1.01] active:scale-[0.99] group cursor-pointer"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="p-1.5 bg-neutral-200/10 rounded-lg text-neutral-300 group-hover:bg-white group-hover:text-black transition-colors">
                                            <MessageSquare className="w-4 h-4" />
                                          </div>
                                          <span className="text-xs font-bold text-neutral-200 group-hover:text-white transition-colors">Enviar no chat mesmo</span>
                                        </div>
                                        <p className="text-[11px] text-neutral-450 leading-normal">
                                          Envia todo o conteúdo diretamente na conversa em formato de texto corrido, sem convertê-lo em cartão ou arquivo.
                                        </p>
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="prose w-full max-w-none prose-invert break-words">
                                    <Markdown>{msg.hasSelectedChatMode ? msg.content : stripCodeBlocks(msg.content)}</Markdown>
                                  </div>
                                )
                              ) : (
                                <p className="whitespace-pre-wrap text-sm md:text-base break-words">{msg.content}</p>
                              )}

                              {/* Render Attachments */}
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2.5">
                                  {msg.attachments.map((att, index) => {
                                    const isImage = att.content.startsWith('data:image/');
                                    const extData = extensionConfig[att.extension] || { label: att.extension.toUpperCase(), color: 'text-neutral-400 border-neutral-700/55', bg: 'bg-neutral-800/50' };

                                    return (
                                      <div 
                                        key={index} 
                                        className="flex flex-col gap-2 p-3 bg-neutral-900/60 border border-neutral-800/80 rounded-xl max-w-[240px] shrink-0"
                                      >
                                        {isImage ? (
                                          <div className="relative rounded-lg overflow-hidden border border-neutral-800 h-28 w-44 bg-black/40 flex items-center justify-center">
                                            <img 
                                              src={att.content} 
                                              alt={att.name} 
                                              className="max-h-full max-w-full object-contain"
                                              referrerPolicy="no-referrer"
                                            />
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-3 w-44">
                                            <div className={`p-2 rounded-lg border text-xs font-bold font-mono shrink-0 ${extData.color} ${extData.bg}`}>
                                              {extData.label}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                              <p className="text-xs font-semibold text-neutral-200 truncate" title={att.name}>{att.name}</p>
                                              <p className="text-[10px] text-neutral-500 font-medium">{att.size}</p>
                                            </div>
                                          </div>
                                        )}
                                        
                                        <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-neutral-800/40">
                                          <span className="text-[10px] text-neutral-500 font-mono">
                                            {isImage ? 'IMG' : extData.label}
                                          </span>
                                          <div className="flex gap-1.5">
                                            {!isImage && (
                                              <button
                                                type="button"
                                                onClick={() => setViewingItem({ title: att.name, content: att.content, extension: att.extension })}
                                                className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                                                title="Visualizar"
                                              >
                                                <FileText className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                            <a
                                              href={att.content.startsWith('data:') ? att.content : URL.createObjectURL(new Blob([att.content], { type: 'text/plain' }))}
                                              download={att.name}
                                              className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200 transition-colors"
                                              title="Baixar"
                                            >
                                              <Download className="w-3.5 h-3.5" />
                                            </a>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Render Pasted Contents */}
                              {msg.pastedContents && msg.pastedContents.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2.5">
                                  {msg.pastedContents.map((past, index) => {
                                    const extData = extensionConfig[past.extension] || { label: 'TXT', color: 'text-neutral-400 border-neutral-700/55', bg: 'bg-neutral-800/50' };

                                    return (
                                      <div 
                                        key={index}
                                        onClick={() => setViewingItem({ title: past.title, content: past.content, extension: past.extension })}
                                        className="flex items-center justify-between p-3 bg-neutral-900/40 hover:bg-neutral-900/70 border border-neutral-800/80 hover:border-neutral-700 rounded-xl w-full max-w-[320px] cursor-pointer transition-all active:scale-[0.99] group"
                                      >
                                        <div className="flex items-center gap-3 min-w-0">
                                          <div className={`p-2 rounded-lg border text-xs font-bold font-mono shrink-0 ${extData.color} ${extData.bg}`}>
                                            {extData.label}
                                          </div>
                                          <div className="min-w-0">
                                            <p className="text-xs font-semibold text-neutral-200 group-hover:text-white transition-colors truncate" title={past.title}>
                                              {past.title}
                                            </p>
                                            <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                                              Conteúdo colado • {past.lineCount} linhas
                                            </p>
                                          </div>
                                        </div>
                                        
                                        <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-neutral-400 transition-colors shrink-0 ml-2" />
                                      </div>
                                    );
                                  })}
                                </div>
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
                {/* Pending Attachments & Pastes Row */}
                {(pendingAttachments.length > 0 || pendingPastedContents.length > 0) && (
                  <div className="flex gap-2 overflow-x-auto pb-3 mb-1.5 scrollbar-none">
                    {pendingAttachments.map((att, idx) => {
                      const isImage = att.content.startsWith('data:image/');
                      const extData = extensionConfig[att.extension] || { label: att.extension.toUpperCase(), color: 'text-neutral-400 border-neutral-700/55', bg: 'bg-neutral-800/50' };
                      
                      return (
                        <div 
                          key={`pending-att-${idx}`}
                          className="flex items-center gap-2 bg-neutral-900/90 border border-neutral-800 rounded-xl pl-2.5 pr-1.5 py-1.5 max-w-[180px] shrink-0 text-xs text-neutral-350 animate-in fade-in slide-in-from-bottom-2 duration-200"
                        >
                          {isImage ? (
                            <img src={att.content} className="w-6 h-6 object-cover rounded" alt="Preview" referrerPolicy="no-referrer" />
                          ) : (
                            <div className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 ${extData.color} ${extData.bg}`}>
                              {extData.label}
                            </div>
                          )}
                          <span className="truncate flex-1 font-semibold">{att.name}</span>
                          <button
                            type="button"
                            onClick={() => setPendingAttachments(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-neutral-200 transition-colors cursor-pointer shrink-0"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}

                    {pendingPastedContents.map((past, idx) => {
                      const extData = extensionConfig[past.extension] || { label: 'TXT', color: 'text-neutral-400 border-neutral-700/55', bg: 'bg-neutral-800/50' };

                      return (
                        <div 
                          key={`pending-paste-${idx}`}
                          className="flex items-center gap-2 bg-neutral-900/90 border border-neutral-800 rounded-xl pl-2.5 pr-1.5 py-1.5 max-w-[180px] shrink-0 text-xs text-neutral-350 animate-in fade-in slide-in-from-bottom-2 duration-200"
                        >
                          <div className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 ${extData.color} ${extData.bg}`}>
                            {extData.label}
                          </div>
                          <span className="truncate flex-1 font-semibold">{past.title}</span>
                          <button
                            type="button"
                            onClick={() => setPendingPastedContents(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-neutral-200 transition-colors cursor-pointer shrink-0"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <form 
                  onSubmit={handleSubmit}
                  className="relative flex items-center bg-black border-2 border-neutral-700 rounded-[24px] px-3.5 py-1.5 focus-within:border-neutral-500 transition-all shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] min-h-[48px] overflow-visible"
                >
                  {/* Left Controls (Menu and Attachments) */}
                  <div className="relative flex items-center justify-center shrink-0 gap-1.5 mr-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsInputMenuOpen(!isInputMenuOpen);
                        setIsModelMenuOpen(false);
                        setIsAttachmentMenuOpen(false);
                      }}
                      className={`p-1.5 rounded-full transition-all border cursor-pointer ${
                        isInputMenuOpen ? 'bg-black border-neutral-700 text-neutral-100' : 'border-transparent text-neutral-600 hover:text-neutral-400 hover:bg-black'
                      }`}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsAttachmentMenuOpen(!isAttachmentMenuOpen);
                        setIsInputMenuOpen(false);
                      }}
                      className={`p-1.5 rounded-full transition-all border cursor-pointer ${
                        isAttachmentMenuOpen ? 'bg-neutral-900 border-neutral-800 text-neutral-100' : 'border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
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

                          <div className="h-px bg-neutral-800/60 my-1" />

                          <a
                            href="https://hoy-0-1.vercel.app"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setIsInputMenuOpen(false)}
                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border border-transparent text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                          >
                            <div className="flex items-center gap-2.5">
                              <Smartphone className="w-4 h-4 text-rose-500" />
                              Download APK
                            </div>
                            <DownloadCloud className="w-3.5 h-3.5 text-neutral-600" />
                          </a>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Attachment Menu Popup */}
                    <AnimatePresence>
                      {isAttachmentMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="absolute bottom-full left-0 mb-3 bg-neutral-950/95 border border-neutral-850 rounded-2xl p-1.5 shadow-2xl min-w-[185px] z-50 backdrop-blur-xl flex flex-col gap-0.5"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setIsCameraActive(true);
                              setIsAttachmentMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-neutral-450 hover:text-neutral-100 hover:bg-neutral-900 transition-all text-left cursor-pointer"
                          >
                            <Camera className="w-4 h-4 text-rose-400" />
                            Câmera
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              photoInputRef.current?.click();
                              setIsAttachmentMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-neutral-450 hover:text-neutral-100 hover:bg-neutral-900 transition-all text-left cursor-pointer"
                          >
                            <ImageIcon className="w-4 h-4 text-emerald-400" />
                            Fotos
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              fileInputRef.current?.click();
                              setIsAttachmentMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-neutral-450 hover:text-neutral-100 hover:bg-neutral-900 transition-all text-left cursor-pointer"
                          >
                            <FileText className="w-4 h-4 text-blue-400" />
                            Arquivos
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsWebSearchActive(true);
                              setIsAttachmentMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-neutral-450 hover:text-neutral-100 hover:bg-neutral-900 transition-all text-left cursor-pointer"
                          >
                            <Search className="w-4 h-4 text-amber-400" />
                            Busca na Web
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Input Textarea Container */}
                  <div className="flex-1 relative mx-3 min-w-0">
                    {!input && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none text-sm md:text-base leading-relaxed shimmer-text font-medium opacity-40 select-none">
                        Ask for scripting...
                      </div>
                    )}
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onPaste={handlePaste}
                      className="w-full bg-transparent text-neutral-200 placeholder:text-transparent py-1.5 resize-none focus:outline-none text-sm md:text-base leading-relaxed block max-h-[180px] min-h-[32px]"
                      rows={1}
                    />
                  </div>

                  {/* Right Send Button */}
                  <div className="shrink-0">
                    <button
                      type="submit"
                      disabled={(!input.trim() && pendingAttachments.length === 0 && pendingPastedContents.length === 0) || isGenerating}
                      className="p-1.5 bg-neutral-100 hover:bg-white text-neutral-950 disabled:opacity-20 rounded-full transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
                    >
                      <SendHorizontal className="w-4 h-4" />
                    </button>
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

      {/* CAMERA CAPTURE MODAL */}
      <AnimatePresence>
        {isCameraActive && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-950 border border-neutral-800 rounded-3xl overflow-hidden w-full max-w-lg shadow-2xl relative"
            >
              <div className="p-5 border-b border-neutral-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-rose-500 animate-pulse" />
                  <span className="text-sm font-bold uppercase tracking-wider text-neutral-200">Capturar Foto</span>
                </div>
                <button 
                  onClick={() => setIsCameraActive(false)}
                  className="p-1 hover:bg-neutral-900 rounded-lg text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative aspect-video bg-neutral-900 flex items-center justify-center overflow-hidden">
                {cameraError ? (
                  <div className="flex flex-col items-center justify-center text-center p-6 gap-3">
                    <ShieldAlert className="w-10 h-10 text-rose-500/80" />
                    <p className="text-xs text-neutral-400 max-w-sm leading-relaxed">{cameraError}</p>
                    <button 
                      onClick={capturePhoto}
                      className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-neutral-100 text-xs font-bold rounded-lg transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      Capturar Simulação
                    </button>
                  </div>
                ) : (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                )}
              </div>

              {!cameraError && (
                <div className="p-5 bg-neutral-950/60 flex items-center justify-center gap-3">
                  <button 
                    onClick={() => setIsCameraActive(false)}
                    className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-850 text-neutral-400 text-xs font-bold rounded-xl transition-colors cursor-pointer uppercase tracking-wider"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={capturePhoto}
                    className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer uppercase tracking-wider shadow-lg shadow-rose-500/20"
                  >
                    Tirar Foto
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WEB SEARCH MODAL */}
      <AnimatePresence>
        {isWebSearchActive && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-950 border border-neutral-800 rounded-3xl overflow-hidden w-full max-w-xl shadow-2xl relative flex flex-col max-h-[85vh]"
            >
              <div className="p-5 border-b border-neutral-800/60 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-amber-500 animate-pulse" />
                  <span className="text-sm font-bold uppercase tracking-wider text-neutral-200">Busca na Web</span>
                </div>
                <button 
                  onClick={() => setIsWebSearchActive(false)}
                  className="p-1 hover:bg-neutral-900 rounded-lg text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search input bar */}
              <div className="p-5 border-b border-neutral-800/30 shrink-0">
                <form onSubmit={handleWebSearch} className="relative flex items-center">
                  <input 
                    type="text"
                    value={webSearchQuery}
                    onChange={(e) => setWebSearchQuery(e.target.value)}
                    placeholder="Pesquise na documentação Roblox, Luau..."
                    className="w-full bg-black border border-neutral-800 rounded-xl py-3 pl-4 pr-12 text-neutral-200 placeholder:text-neutral-700 focus:outline-none focus:border-neutral-600 transition-all text-sm"
                  />
                  <button 
                    type="submit"
                    className="absolute right-2 p-2 bg-neutral-900 hover:bg-neutral-850 text-neutral-400 hover:text-neutral-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </form>
              </div>

              {/* Results display area */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {isSearchingWeb ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-neutral-500">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-500/80" />
                    <p className="text-xs font-mono">Buscando na Web...</p>
                  </div>
                ) : webSearchResults.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-1">Resultados Encontrados</p>
                    {webSearchResults.map((res, idx) => (
                      <div 
                        key={idx}
                        className="p-3.5 bg-neutral-900/40 hover:bg-neutral-900/80 border border-neutral-850 hover:border-neutral-700/60 rounded-2xl flex flex-col gap-1 transition-all"
                      >
                        <h4 className="text-xs font-bold text-neutral-200 leading-snug">{res.title}</h4>
                        <span className="text-[10px] text-amber-400/90 hover:underline cursor-pointer truncate" onClick={() => window.open(res.url, '_blank')}>{res.url}</span>
                        <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{res.snippet}</p>
                        
                        <div className="flex justify-end mt-2">
                          <button
                            type="button"
                            onClick={() => attachWebResult(res)}
                            className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black text-[10px] font-bold rounded-lg transition-all cursor-pointer uppercase tracking-wider"
                          >
                            Anexar ao Chat
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-600 gap-2">
                    <Globe className="w-10 h-10 stroke-[1.2] opacity-40" />
                    <p className="text-xs max-w-xs leading-relaxed">Digite o que deseja buscar e pressione Enter para consultar e anexar referências direto do Roblox Studio Developer Guide.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL PARA VISUALIZAR CONTEÚDO COLADO / ARQUIVOS */}
      <AnimatePresence>
        {viewingItem && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-950 border border-neutral-800 rounded-3xl overflow-hidden w-full max-w-2xl shadow-2xl relative flex flex-col h-[75vh]"
            >
              <div className="p-5 border-b border-neutral-800/60 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="px-2 py-1 bg-neutral-900 border border-neutral-800 text-[10px] font-mono font-bold text-neutral-300 rounded">
                    {(viewingItem.extension || 'txt').toUpperCase()}
                  </div>
                  <span className="text-sm font-bold text-neutral-200 truncate max-w-sm" title={viewingItem.title}>
                    {viewingItem.title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={URL.createObjectURL(new Blob([viewingItem.content], { type: 'text/plain' }))}
                    download={viewingItem.title}
                    className="p-1.5 hover:bg-neutral-900 rounded-lg text-neutral-400 hover:text-neutral-200 transition-colors"
                    title="Baixar"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button 
                    onClick={() => setViewingItem(null)}
                    className="p-1 hover:bg-neutral-900 rounded-lg text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 bg-black/20 font-mono text-xs text-neutral-300 leading-relaxed overflow-x-auto selection:bg-neutral-800">
                <pre>{viewingItem.content}</pre>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HIDDEN INPUT FOR FILE UPLOADS */}
      <input 
        type="file"
        ref={photoInputRef}
        onChange={(e) => handleFileChange(e, 'image')}
        accept="image/*"
        className="hidden"
      />
      <input 
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFileChange(e, 'file')}
        accept=".lua,.txt,.json,.js,.ts,.py,.html,.css,.md,.xml,.yaml,.pdf,.zip"
        className="hidden"
      />
    </div>
  );
}
