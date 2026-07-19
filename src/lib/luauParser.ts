/**
 * Utility to parse and apply Luau scripts and edits from AI responses.
 */

/**
 * Extracts the first code block from a markdown response, supporting partial blocks for streaming.
 */
export function extractCodeBlock(markdown: string): string | null {
  const regex = /```(?:lua|luau|)\n([\s\S]*?)(?:```|$)/i;
  const match = regex.exec(markdown);
  return match ? match[1] : null;
}

/**
 * Applies search, edit, end modifications to an existing script.
 * Supports partial blocks for streaming.
 */
export function applyScriptEdits(currentCode: string, aiResponse: string): { updatedCode: string; successCount: number; failCount: number } {
  let updatedCode = currentCode || "";
  let successCount = 0;
  let failCount = 0;

  // Normalize line endings
  updatedCode = updatedCode.replace(/\r\n/g, "\n");
  const normalizedResponse = aiResponse.replace(/\r\n/g, "\n");

  // Regex to match [SEARCH] ... [EDIT] ... [END] with flexible spacing
  // Supports partial [END] for streaming
  const blockRegex = /\[SEARCH\]\s*?\n([\s\S]*?)\n?\s*?\[EDIT\]\s*?\n([\s\S]*?)(?:\n?\s*?\[END\]|$)/gi;
  let match;

  // Let's copy updatedCode so we can do sequential replacements
  let tempCode = updatedCode;

  // We find all blocks
  const blocks: { search: string; edit: string }[] = [];
  while ((match = blockRegex.exec(normalizedResponse)) !== null) {
    blocks.push({
      search: match[1], 
      edit: match[2] 
    });
  }

  if (blocks.length === 0) {
    // If no explicit SEARCH/EDIT tags are found, but there is a single code block,
    // and currentCode is empty, let's treat that as the initial script.
    // OR if there is a single code block and the AI says it's replacing it.
    const codeBlock = extractCodeBlock(aiResponse);
    if (codeBlock) {
      if (!tempCode || aiResponse.toLowerCase().includes("substitu") || aiResponse.toLowerCase().includes("replace")) {
        return { updatedCode: codeBlock, successCount: 1, failCount: 0 };
      }
    }
    return { updatedCode, successCount: 0, failCount: 0 };
  }

  for (const block of blocks) {
    // Exact match search
    const searchStr = block.search.trim();
    const replaceStr = block.edit;

    // Try exact match first on the whole block
    if (tempCode.includes(searchStr)) {
      tempCode = tempCode.replace(searchStr, replaceStr);
      successCount++;
    } else {
      // Try line by line or more flexible match
      const searchLines = searchStr.split("\n").map(l => l.trim()).filter(Boolean);
      
      if (searchLines.length === 0) {
        failCount++;
        continue;
      }

      // If it's a small number of lines, try to find them even with different indentation
      const codeLines = tempCode.split("\n");
      let foundIndex = -1;

      // Look for the first line of the search block
      for (let i = 0; i < codeLines.length; i++) {
        if (codeLines[i].trim() === searchLines[0]) {
          // Check if subsequent lines match
          let allMatch = true;
          for (let j = 1; j < searchLines.length; j++) {
            if (i + j >= codeLines.length || codeLines[i + j].trim() !== searchLines[j]) {
              allMatch = false;
              break;
            }
          }
          if (allMatch) {
            foundIndex = i;
            break;
          }
        }
      }

      if (foundIndex !== -1) {
        // Construct the part of the code to replace
        const originalLines = codeLines.slice(foundIndex, foundIndex + searchLines.length);
        const originalStr = originalLines.join("\n");
        tempCode = tempCode.replace(originalStr, replaceStr);
        successCount++;
      } else {
        failCount++;
      }
    }
  }

  return {
    updatedCode: tempCode,
    successCount,
    failCount
  };
}
