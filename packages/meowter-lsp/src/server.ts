import { fileURLToPath } from "node:url";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
  type CompletionItem,
  type CompletionParams,
  type InitializeParams,
  type InitializeResult,
} from "vscode-languageserver/node.js";

import { buildCompletionItems, detectContext } from "./completion.js";
import { createRouteIndex, type RouteIndex } from "./route-index.js";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

let routeIndex: RouteIndex | null = null;

connection.onInitialize(
  async (params: InitializeParams): Promise<InitializeResult> => {
    const folders = (params.workspaceFolders ?? [])
      .map((f) => fileURLToPath(f.uri))
      .filter(Boolean);
    if (folders.length === 0 && params.rootUri) {
      folders.push(fileURLToPath(params.rootUri));
    }
    if (folders.length === 0) folders.push(process.cwd());

    routeIndex = await createRouteIndex({
      workspaceFolders: folders,
      globs: ["**/*.html", "!**/node_modules/**", "!**/dist/**"],
    });

    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        completionProvider: {
          triggerCharacters: ['"', "'", "/"],
          resolveProvider: false,
        },
      },
    };
  },
);

connection.onShutdown(async () => {
  await routeIndex?.dispose();
  routeIndex = null;
});

connection.onCompletion((params: CompletionParams): CompletionItem[] => {
  if (!routeIndex) return [];
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];

  const language = detectLanguage(params.textDocument.uri);
  if (!language) return [];

  const linePrefix = doc.getText({
    start: { line: params.position.line, character: 0 },
    end: params.position,
  });

  if (!detectContext(language, linePrefix)) return [];
  return buildCompletionItems(routeIndex.paths());
});

function detectLanguage(uri: string): "html" | "ts" | null {
  if (uri.endsWith(".html") || uri.endsWith(".htm")) return "html";
  if (
    uri.endsWith(".ts") ||
    uri.endsWith(".tsx") ||
    uri.endsWith(".js") ||
    uri.endsWith(".jsx") ||
    uri.endsWith(".mjs") ||
    uri.endsWith(".cjs")
  ) {
    return "ts";
  }
  return null;
}

documents.listen(connection);
connection.listen();
