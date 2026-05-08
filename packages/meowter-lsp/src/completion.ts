import {
  CompletionItemKind,
  InsertTextFormat,
  type CompletionItem,
} from "vscode-languageserver";

const HTML_HREF_PREFIX = /(?:href|src|data-href)\s*=\s*(["'])([^"']*)$/;
const TS_CALL_PREFIX = /\.(navigate|replace)\s*\(\s*(["'`])([^"'`]*)$/;

export type CompletionLanguage = "html" | "ts";

/**
 * Decide whether the cursor is in a position where route-path
 * completions are useful, based on the line text up to (but not
 * including) the cursor.
 */
export function detectContext(
  language: CompletionLanguage,
  linePrefix: string,
): boolean {
  if (language === "html") return HTML_HREF_PREFIX.test(linePrefix);
  if (language === "ts") return TS_CALL_PREFIX.test(linePrefix);
  return false;
}

/**
 * Build LSP `CompletionItem`s for the registered paths. For paths
 * containing `:param` segments, emit two items: the literal pattern
 * and a snippet form that lets the user tab-fill each param.
 */
export function buildCompletionItems(
  paths: readonly string[],
): CompletionItem[] {
  const out: CompletionItem[] = [];
  for (const path of paths) {
    out.push({
      label: path,
      kind: CompletionItemKind.Value,
      insertText: path,
      detail: "meowter route",
      sortText: sortKey(path, /* snippet */ false),
    });
    if (hasParam(path)) {
      const snippet = toSnippet(path);
      out.push({
        label: `${path}  (fill params)`,
        filterText: path,
        kind: CompletionItemKind.Snippet,
        insertText: snippet,
        insertTextFormat: InsertTextFormat.Snippet,
        detail: "meowter route — fill params",
        sortText: sortKey(path, /* snippet */ true),
      });
    }
  }
  return out;
}

function hasParam(path: string): boolean {
  return /(?:^|\/):[^/]+/.test(path);
}

function toSnippet(path: string): string {
  let i = 0;
  return path.replace(/(^|\/):([^/]+)/g, (_, slash: string, name: string) => {
    i++;
    return `${slash}\${${i}:${name}}`;
  });
}

function sortKey(path: string, isSnippet: boolean): string {
  // catch-all last; literal before snippet for the same path
  const prefix = path === "*" ? "z" : "a";
  return `${prefix}-${path}-${isSnippet ? "1" : "0"}`;
}
