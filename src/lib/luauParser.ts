/**
 * Utility to parse and apply Luau scripts and edits from AI responses.
 */

/**
 * Extracts the first full code block from a markdown response, if present.
 */
export function extractCodeBlock(markdown: string): string | null {
  const regex = /```(?:lua|luau|)\n([\s\S]*?)```/i;
  const match = regex.exec(markdown);
  return match ? match[1].trim() : null;
}

/**
 * Applies search, edit, end modifications to an existing script.
 * 
 * Format expected:
 * [SEARCH]
 * exact line(s) to match
 * [EDIT]
 * replacement line(s)
 * [END]
 */
export function applyScriptEdits(currentCode: string, aiResponse: string): { updatedCode: string; successCount: number; failCount: number } {
  let updatedCode = currentCode || "";
  let successCount = 0;
  let failCount = 0;

  // Normalize line endings
  updatedCode = updatedCode.replace(/\r\n/g, "\n");
  const normalizedResponse = aiResponse.replace(/\r\n/g, "\n");

  // Regex to match [SEARCH] ... [EDIT] ... [END]
  // We use [\s\S]*? to be lazy and grab the smallest possible block matching the tags
  const blockRegex = /\[SEARCH\]\n([\s\S]*?)\n?\[EDIT\]\n([\s\S]*?)\n?\[END\]/gi;
  let match;

  // Let's copy updatedCode so we can do sequential replacements
  let tempCode = updatedCode;

  // We find all blocks
  const blocks: { search: string; edit: string }[] = [];
  while ((match = blockRegex.exec(normalizedResponse)) !== null) {
    blocks.push({
      search: match[1].trim(),
      edit: match[2] // Keep whitespace format for replacement
    });
  }

  if (blocks.length === 0) {
    // If no explicit SEARCH/EDIT tags are found, but there is a single code block,
    // and currentCode is empty, let's treat that as the initial script.
    if (!tempCode) {
      const codeBlock = extractCodeBlock(aiResponse);
      if (codeBlock) {
        return { updatedCode: codeBlock, successCount: 1, failCount: 0 };
      }
    }
    return { updatedCode, successCount: 0, failCount: 0 };
  }

  for (const block of blocks) {
    // Exact match search
    const searchStr = block.search;
    const replaceStr = block.edit;

    if (tempCode.includes(searchStr)) {
      tempCode = tempCode.replace(searchStr, replaceStr);
      successCount++;
    } else {
      // Let's try matching with trimmed lines to account for minor indentation or spacing differences
      const searchLines = searchStr.split("\n").map(l => l.trim()).filter(Boolean);
      
      if (searchLines.length === 0) {
        failCount++;
        continue;
      }

      // If it's a single line search, try to match it with flexible spaces
      if (searchLines.length === 1) {
        const escaped = searchStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        // allow arbitrary leading spaces
        const flexRegex = new RegExp(`^[ \t]*${escaped}[ \t]*$`, 'm');
        if (flexRegex.test(tempCode)) {
          tempCode = tempCode.replace(flexRegex, replaceStr);
          successCount++;
        } else {
          failCount++;
        }
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
