import "@fontsource-variable/lilex";
import "@picocss/pico/css/pico.min.css";
import "./styles.css";

import { createRenderEffect, createRoot } from "@solidjs/signals";
import "meowter";
import type { MeowRoute, MeowRouter } from "meowter";
import logoUrl from "../../meowter-logo.svg?url";

const logoEl = document.querySelector<HTMLImageElement>("#meowter-logo");
if (logoEl) logoEl.src = logoUrl;

const router = document.querySelector<MeowRouter>("meow-router");
if (!router) throw new Error("kitchen sink: meow-router missing");
router.basepath = import.meta.env.BASE_URL;

const filterInput = document.querySelector<HTMLInputElement>("#search-filter");
const sortSelect = document.querySelector<HTMLSelectElement>("#search-sort");
const addTagBtn = document.querySelector<HTMLButtonElement>("#search-add-tag");
const clearBtn = document.querySelector<HTMLButtonElement>("#search-clear");
const searchReadout = document.querySelector<HTMLPreElement>("#search-readout");
const debugContent = document.querySelector<HTMLElement>("#debug-content");
const navLinks = Array.from(
  document.querySelectorAll<HTMLAnchorElement>("aside nav a[data-nav]"),
);

function pathOf(href: string): string {
  const u = new URL(href, window.location.origin);
  return u.pathname + u.search;
}

function stripBase(pathname: string, basepath: string): string {
  if (basepath === "/" || !pathname.startsWith(basepath)) return pathname;
  return "/" + pathname.slice(basepath.length);
}

function isActiveLink(stripped: string, pathname: string): boolean {
  if (stripped === "/") return pathname === "/";
  return pathname === stripped || pathname.startsWith(stripped + "/");
}

function wireSearchControls(r: MeowRouter): void {
  filterInput?.addEventListener("input", () => {
    r.setSearchParam("filter", filterInput.value || null);
  });
  sortSelect?.addEventListener("change", () => {
    r.setSearchParam("sort", sortSelect.value || null);
  });
  addTagBtn?.addEventListener("click", () => {
    const existing = r.searchParams["tag"] ?? [];
    r.setSearchParam("tag", [...existing, `tag${existing.length + 1}`]);
  });
  clearBtn?.addEventListener("click", () => {
    for (const key of Object.keys(r.searchParams)) r.setSearchParam(key, null);
  });
}

function wireProgrammaticButtons(r: MeowRouter): void {
  for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-action]")) {
    btn.addEventListener("click", () => {
      const action = btn.dataset["action"];
      const href = btn.dataset["href"];
      if (action === "navigate" && href) r.navigate(href);
      else if (action === "replace" && href) r.replace(href);
      else if (action === "navigate-state") r.navigate("/about", { from: "demo" });
      else if (action === "back") window.history.back();
      else if (action === "forward") window.history.forward();
    });
  }
}

function bindParamSpans(): void {
  for (const route of document.querySelectorAll<MeowRoute>("meow-route")) {
    const targets = route.querySelectorAll<HTMLElement>("[data-param]");
    if (targets.length === 0) continue;
    createRenderEffect(
      () => route.paramsAccessor(),
      (params) => {
        for (const target of targets) {
          const name = target.dataset["param"];
          if (name) target.textContent = params?.[name] ?? "";
        }
      },
    );
  }
}

function bindNavActiveState(r: MeowRouter): void {
  const bp = r.basepath;
  const linkPaths = navLinks.map((link) => stripBase(link.pathname, bp));
  createRenderEffect(
    () => r.matchURL().pathname,
    (pathname) => {
      navLinks.forEach((link, i) => {
        if (isActiveLink(linkPaths[i]!, pathname)) {
          link.setAttribute("aria-current", "page");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    },
  );
}

function bindSearchSync(r: MeowRouter): void {
  createRenderEffect(
    () => r.searchParams.filter?.[0] ?? "",
    (filter) => {
      if (filterInput && filterInput.value !== filter) filterInput.value = filter;
    },
  );
  createRenderEffect(
    () => r.searchParams.sort?.[0] ?? "",
    (sort) => {
      if (sortSelect && sortSelect.value !== sort) sortSelect.value = sort;
    },
  );
  createRenderEffect(
    () => JSON.stringify(r.searchParams, null, 2),
    (text) => {
      if (searchReadout) searchReadout.textContent = text === "{}" ? "(none)" : text;
    },
  );
}

interface DebugInfo {
  url: string;
  state: unknown;
  historyIndex: number;
  historyEntries: string[];
}

function renderDebugPanel(host: HTMLElement, info: DebugInfo): void {
  host.innerHTML = "";
  const dl = document.createElement("dl");
  const rows: Array<[string, string]> = [
    ["URL", info.url],
    ["State", JSON.stringify(info.state)],
    ["History", `${info.historyIndex + 1} / ${info.historyEntries.length}`],
  ];
  for (const [key, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = key;
    const dd = document.createElement("dd");
    dd.textContent = value;
    dl.append(dt, dd);
  }
  host.append(dl);
  const pre = document.createElement("pre");
  pre.textContent =
    info.historyEntries
      .map((path, i) => `  ${i}: ${path}${i === info.historyIndex ? " ←" : ""}`)
      .join("\n") || "(empty)";
  host.append(pre);
}

function bindDebugPanel(r: MeowRouter, host: HTMLElement): void {
  createRenderEffect(
    () => ({
      url: r.currentURL().pathname + r.currentURL().search,
      state: r.currentState(),
      historyIndex: r.history.index,
      historyEntries: r.history.entries.map((e) => pathOf(e.href)),
    }),
    (info) => renderDebugPanel(host, info),
  );
}

wireSearchControls(router);
wireProgrammaticButtons(router);

createRoot(() => {
  bindParamSpans();
  bindNavActiveState(router);
  bindSearchSync(router);
  if (debugContent) bindDebugPanel(router, debugContent);
});
