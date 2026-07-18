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

async function generateContentWithRetryAndFallback(contents: any, systemInstruction: string, preferredModel?: string, thinkingEnabled?: boolean) {
  const modelsToTry = [
    "gemini-3.5-flash",
    "gemini-3.1-pro-preview",
    "gemini-3-flash-preview",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
    "gemini-3-pro-image"
  ];
  
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

        const response = await ai.models.generateContent({
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

  // API route for script generation
  app.post("/api/generate", async (req, res) => {
    try {
      const { messages, selectedModel, thinkingEnabled } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Invalid messages format" });
      }

      // Format messages for the model
      const contents = messages.map(msg => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      }));

      const systemInstruction = `You are an elite Luau and Roblox Studio developer.
Your sole purpose is to write optimized, performant, clean, and secure Luau code.
This code will be executed in Roblox Studio (Server/Client) or through Roblox exploit executors (like Wave, Solara, Synapse, Celery, etc.).

CRITICAL CODING GUIDELINES:
1. Always localize services at the top of the script using 'game:GetService()' (e.g. local Players = game:GetService("Players")).
2. Never use legacy 'wait()'. Always use 'task.wait()'.
3. Always use local variables and functions to preserve performance and prevent global namespace pollution.
4. When writing exploit-executor scripts:
   - Check if custom functions exist before using them (e.g., 'if fireclickdetector then ... else ...').
   - Use 'getgenv()' for global environment variables inside executors.
   - Use 'hookmetamethod' or 'hookfunction' for method hooking safely.
   - Check if objects exist with 'FindFirstChild' or 'WaitForChild' to prevent breaking errors.
5. Provide clean, well-commented code using '--' for comments. Do not use '#' or '//'.

CRITICAL INSTRUCTION FOR SCRIPT EDITS/MODIFICATIONS:
When the user asks to edit, add, delete, or modify an existing script, you MUST use the exact search/edit/end format. This allows the editor to patch the user's code seamlessly.
The block MUST match the syntax below:

[SEARCH]
exact lines of code from the existing script to be replaced (include the correct indentation and spaces)
[EDIT]
the replacement lines of code (or leave empty to delete)
[END]

- You can provide multiple [SEARCH]/[EDIT]/[END] blocks in a single response to patch multiple sections.
- Make sure that the [SEARCH] block matches the existing script EXACTLY.
- If you are creating a completely new script from scratch (with no prior script or a brand new topic), just provide the full script inside a standard lua codeblock: \`\`\`lua ... \`\`\`.

Keep explanations and conversational text to an absolute minimum. Be direct, minimalist, and let the code speak for itself.`;

      const resultText = await generateContentWithRetryAndFallback(contents, systemInstruction, selectedModel, thinkingEnabled);

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
