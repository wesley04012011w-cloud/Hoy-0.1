import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function generateContentWithRetryAndFallback(contents: any, systemInstruction: string, preferredModel?: string, thinkingEnabled?: boolean, userApiKey?: string) {
  const modelsToTry = [
    "gemini-3.5-flash",
    "gemini-3.1-pro-preview",
    "gemini-3-flash-preview",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
    "gemini-3-pro-image"
  ];
  
  // Use user-provided API key if available, otherwise use environment variable
  const client = new GoogleGenAI({ 
    apiKey: userApiKey || process.env.GEMINI_API_KEY || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Put preferredModel at the top of the list if provided
  const sortedModels = preferredModel && preferredModel.length > 0
    ? [preferredModel, ...modelsToTry.filter(m => m !== preferredModel)]
    : modelsToTry;

  let lastError: any = null;

  for (const model of sortedModels) {
    let attempts = 0;
    const maxAttempts = 2;
    
    while (attempts < maxAttempts) {
      try {
        const config: any = {
          systemInstruction,
          temperature: 0.1
        };

        // Thinking is supported on Gemini 3 series models
        if (thinkingEnabled && model.includes("gemini-3")) {
          config.thinkingConfig = {
            thinkingLevel: ThinkingLevel.HIGH
          };
        }

        const response = await client.models.generateContent({
          model,
          contents,
          config
        });

        if (response && response.text) {
          return response.text;
        }
        throw new Error("No response from model");
      } catch (error: any) {
        attempts++;
        lastError = error;
        
        const errorMsg = error.message || "";
        const isQuotaExceeded = error.status === 'RESOURCE_EXHAUSTED' || errorMsg.includes('429');
        const isServiceUnavailable = error.status === 'UNAVAILABLE' || errorMsg.includes('503') || errorMsg.includes('overloaded');
        
        console.warn(`Model ${model} failed (Attempt ${attempts}/${maxAttempts}): ${errorMsg}`);

        if (isQuotaExceeded) {
          const quotaErr = new Error("QUOTA_EXHAUSTED");
          (quotaErr as any).original = error;
          lastError = quotaErr;
          break; 
        }

        if (isServiceUnavailable && attempts < maxAttempts) {
          const delay = attempts * 2000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (isServiceUnavailable) {
          const overloadedErr = new Error("HIGH_DEMAND");
          (overloadedErr as any).original = error;
          lastError = overloadedErr;
        }
        
        break;
      }
    }
  }
  
  const finalError = lastError?.message || "UNKNOWN_ERROR";
  throw new Error(finalError);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API route for script generation
  app.post("/api/generate", async (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/generate received`);
    try {
      const { messages, selectedModel, thinkingEnabled, userApiKey } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        console.error("Invalid messages format received");
        return res.status(400).json({ error: "Invalid messages format" });
      }

      // Format messages for the model
      const contents = messages.map(msg => {
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

      const systemInstruction = `Você é Hoy 0.2 beta, um assistente de elite especializado em Luau e Roblox Studio.

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

      const resultText = await generateContentWithRetryAndFallback(contents, systemInstruction, selectedModel, thinkingEnabled, userApiKey);
      console.log(`[${new Date().toISOString()}] Content generated successfully`);

      res.json({ result: resultText });
    } catch (error: any) {
      console.error("Error generating content:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
