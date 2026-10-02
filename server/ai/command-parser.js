/**
 * JARVIS Phase 3 - Command Parser
 * 
 * Safely parses and normalizes AI output into structured JSON.
 * Strips markdown code blocks and handles malformed responses cleanly.
 */

/**
 * Parse raw text into structured command object
 * 
 * @param {string} rawText Raw output from LLM
 * @returns {object} Parsed command object
 */
function parseCommand(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return {
      action: 'unsupported',
      parameters: {},
      message: "I can't perform that action yet."
    };
  }

  let text = rawText.trim();

  // Strip Markdown JSON code fences if present (```json ... ``` or ``` ...)
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '');
    text = text.replace(/\s*```$/i, '');
    text = text.trim();
  }

  // Attempt JSON parsing
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      return {
        action: parsed.action || 'unsupported',
        parameters: parsed.parameters || {},
        message: parsed.message || (parsed.action === 'unsupported' ? "I can't perform that action yet." : undefined)
      };
    }
  } catch (_) {
    // Attempt extracting first JSON object with regex
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed && typeof parsed === 'object') {
          return {
            action: parsed.action || 'unsupported',
            parameters: parsed.parameters || {},
            message: parsed.message
          };
        }
      } catch (__) {
        // Fall through
      }
    }
  }

  return {
    action: 'unsupported',
    parameters: {},
    message: "I can't perform that action yet."
  };
}

module.exports = {
  parseCommand
};
