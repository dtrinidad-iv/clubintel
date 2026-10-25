// Parses JSON that may be cut off part-way, as it is while a structured response streams in.
// It closes whatever is open (a string, arrays, objects) and drops a dangling key, comma or
// partial literal, then parses what's left. Returns undefined when nothing usable has arrived.
export function parsePartialJson(text: string): unknown {
  const source = text.trimStart();
  if (!source) return undefined;

  const stack: ("{" | "[")[] = [];
  let inString = false;
  let escaped = false;
  // Index just after the last point where the text so far is a complete value in its container.
  let safeEnd = 0;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') {
        inString = false;
        safeEnd = i + 1;
      }
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") {
      stack.push(ch);
      safeEnd = i + 1;
    } else if (ch === "}" || ch === "]") {
      stack.pop();
      safeEnd = i + 1;
    } else if (/[0-9eE.+\-truefalsn]/.test(ch)) {
      // Part of a number or literal: only complete once a delimiter follows.
    } else if (!/\s/.test(ch)) {
      safeEnd = i + 1;
    }
  }

  let candidate: string;
  if (inString) {
    // Keep the open string, minus an escape that is still incomplete: a lone backslash, or a
    // \u with fewer than four hex digits after an odd run of backslashes ("\\" is complete).
    candidate = (escaped ? source.slice(0, -1) : source.replace(/(^|[^\\])((?:\\\\)*)\\u[0-9a-fA-F]{0,3}$/, "$1$2")) + '"';
  } else {
    candidate = source.slice(0, Math.max(safeEnd, completeLiteralEnd(source)));
  }

  return tryParse(close(candidate, stack));
}

// A literal at the very end counts only once complete (true/false/null). A number may still be
// growing ("12" of "123"), but it is valid as it is.
function completeLiteralEnd(source: string): number {
  return /(-?\d+(\.\d+)?([eE][+-]?\d+)?|true|false|null)$/.test(source) ? source.length : 0;
}

function close(candidate: string, stack: ("{" | "[")[]): string {
  let out = candidate.replace(/[\s,]+$/, "");
  // A key with no value yet ("…, "key"" or "…, "key":") is dropped.
  out = out.replace(/,?\s*"(?:[^"\\]|\\.)*"\s*:?\s*$/, (m) => (endsInsideObject(out, stack) ? "" : m));
  out = out.replace(/[\s,:]+$/, "");
  for (let i = stack.length - 1; i >= 0; i--) out += stack[i] === "{" ? "}" : "]";
  return out;
}

// Whether the innermost open container is an object, so a trailing string is a key.
function endsInsideObject(text: string, stack: ("{" | "[")[]): boolean {
  if (stack[stack.length - 1] !== "{") return false;
  // In an object, a trailing string is a key unless a colon precedes it.
  return !/:\s*"(?:[^"\\]|\\.)*"\s*$/.test(text);
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
