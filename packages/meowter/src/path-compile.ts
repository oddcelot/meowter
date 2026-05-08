export interface CompiledPath {
  raw: string;
  paramNames: string[];
  exact: RegExp;
  prefix: RegExp;
  isIndex: boolean;
  isCatchAll: boolean;
}

const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;

function escapeRegex(s: string): string {
  return s.replace(ESCAPE_RE, "\\$&");
}

export function compilePath(raw: string): CompiledPath {
  const isIndex = raw === "";
  const isCatchAll = raw === "*";

  if (isIndex || isCatchAll) {
    return {
      raw,
      paramNames: [],
      exact: /^$/,
      prefix: /^/,
      isIndex,
      isCatchAll,
    };
  }

  const paramNames: string[] = [];
  const normalized = raw.startsWith("/") ? raw : "/" + raw;
  const segments = normalized.split("/").filter((s) => s.length > 0);

  let pattern = "";
  for (const seg of segments) {
    if (seg.startsWith(":")) {
      paramNames.push(seg.slice(1));
      pattern += "/([^/]+)";
    } else {
      pattern += "/" + escapeRegex(seg);
    }
  }

  return {
    raw,
    paramNames,
    exact: new RegExp(`^${pattern}\\/?$`),
    prefix: new RegExp(`^${pattern}(?=\\/|$)`),
    isIndex: false,
    isCatchAll: false,
  };
}

export function extractParams(
  cp: CompiledPath,
  match: RegExpExecArray,
): Record<string, string> {
  const params: Record<string, string> = {};
  cp.paramNames.forEach((name, i) => {
    const v = match[i + 1];
    if (v !== undefined) params[name] = decodeURIComponent(v);
  });
  return params;
}
