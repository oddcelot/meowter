import { appendFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
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

const LOG_ENABLED = process.env["MEOWTER_LSP_LOG"] !== undefined;
const LOG_FILE = resolve(tmpdir(), "meowter-lsp.log");
const log = (...args: unknown[]): void => {
  if (!LOG_ENABLED) return;
  try {
    mkdirSync(tmpdir(), { recursive: true });
    appendFileSync(
      LOG_FILE,
      `[${new Date().toISOString()}] ${args
        .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
        .join(" ")}\n`,
    );
  } catch {
    /* ignore */
  }
};

log("server boot, argv:", process.argv);

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

let routeIndex: RouteIndex | null = null;

connection.onInitialize(
  async (params: InitializeParams): Promise<InitializeResult> => {
    log("initialize", {
      rootUri: params.rootUri,
      folders: params.workspaceFolders,
    });
    const folders = (params.workspaceFolders ?? [])
      .map((f) => fileURLToPath(f.uri))
      .filter(Boolean);
    if (folders.length === 0 && params.rootUri) {
      folders.push(fileURLToPath(params.rootUri));
    }
    if (folders.length === 0) folders.push(process.cwd());

    routeIndex = await createRouteIndex({
      workspaceFolders: folders,
    });
    log("indexed", routeIndex.paths().length, "paths");

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
  log("completion request", {
    uri: params.textDocument.uri,
    pos: params.position,
  });
  if (!routeIndex) {
    log("  no index yet");
    return [];
  }
  const doc = documents.get(params.textDocument.uri);
  if (!doc) {
    log("  no document for uri");
    return [];
  }

  const language = detectLanguage(params.textDocument.uri);
  if (!language) {
    log("  language not detected");
    return [];
  }

  const linePrefix = doc.getText({
    start: { line: params.position.line, character: 0 },
    end: params.position,
  });
  log("  language:", language, "linePrefix:", linePrefix);

  if (!detectContext(language, linePrefix)) {
    log("  context not matched");
    return [];
  }
  const items = buildCompletionItems(routeIndex.paths());
  log("  returning", items.length, "items");
  return items;
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
