import "@fontsource-variable/lilex";
import "@picocss/pico/css/pico.min.css";
import "./styles.css";

import { createRenderEffect, createRoot } from "@solidjs/signals";
import "../../src/index.ts";
import type { MeowRouter } from "../../src/router-element.ts";
import logoUrl from "../../meowter-logo.svg?url";

const logoEl = document.querySelector<HTMLImageElement>("#meowter-logo");
if (logoEl) logoEl.src = logoUrl;

const router = document.querySelector<MeowRouter>("meow-router");
if (!router) throw new Error("kitchen sink: meow-router missing");

document.querySelectorAll<HTMLElement>("meow-route").forEach((route) => {
  route.addEventListener("route-match", (event) => {
    for (const target of route.querySelectorAll<HTMLElement>("[data-param]")) {
      const name = target.dataset["param"];
      if (name) target.textContent = event.detail.params[name] ?? "";
    }
  });
});

const filterInput = document.querySelector<HTMLInputElement>("#search-filter");
const sortSelect = document.querySelector<HTMLSelectElement>("#search-sort");
const addTagBtn = document.querySelector<HTMLButtonElement>("#search-add-tag");
const clearBtn = document.querySelector<HTMLButtonElement>("#search-clear");
const searchReadout = document.querySelector<HTMLPreElement>("#search-readout");

filterInput?.addEventListener("input", () => {
  router.setSearchParam("filter", filterInput.value || null);
});

sortSelect?.addEventListener("change", () => {
  router.setSearchParam("sort", sortSelect.value || null);
});

addTagBtn?.addEventListener("click", () => {
  const existing = router.searchParams["tag"] ?? [];
  const next = [...existing, `tag${existing.length + 1}`];
  router.setSearchParam("tag", next);
});

clearBtn?.addEventListener("click", () => {
  for (const key of Object.keys(router.searchParams)) {
    router.setSearchParam(key, null);
  }
});

document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const action = btn.dataset["action"];
    const href = btn.dataset["href"];
    if (action === "navigate" && href) router.navigate(href);
    else if (action === "replace" && href) router.replace(href);
    else if (action === "navigate-state")
      router.navigate("/examples/kitchensink/about", { from: "demo" });
    else if (action === "back") window.history.back();
    else if (action === "forward") window.history.forward();
  });
});

const debugContent = document.querySelector<HTMLElement>("#debug-content");
const navLinks = Array.from(
  document.querySelectorAll<HTMLAnchorElement>("aside nav a[data-nav]"),
);

function pathOf(href: string): string {
  const u = new URL(href, window.location.origin);
  return u.pathname + u.search;
}

createRoot(() => {
  const HOME_PATH = "/examples/kitchensink/";
  createRenderEffect(
    () => router.currentURL().pathname,
    (pathname) => {
      const normalizedPath = pathname.endsWith("/") ? pathname : pathname + "/";
      for (const link of navLinks) {
        const linkPath = link.pathname.endsWith("/")
          ? link.pathname
          : link.pathname + "/";
        const isActive =
          linkPath === HOME_PATH
            ? normalizedPath === HOME_PATH
            : normalizedPath.startsWith(linkPath);
        if (isActive) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      }
    },
  );

  createRenderEffect(
    () => router.searchParams.filter?.[0] ?? "",
    (filter) => {
      if (filterInput && filterInput.value !== filter) filterInput.value = filter;
    },
  );

  createRenderEffect(
    () => router.searchParams.sort?.[0] ?? "",
    (sort) => {
      if (sortSelect && sortSelect.value !== sort) sortSelect.value = sort;
    },
  );

  createRenderEffect(
    () => JSON.stringify(router.searchParams, null, 2),
    (text) => {
      if (searchReadout) searchReadout.textContent = text === "{}" ? "(none)" : text;
    },
  );

  createRenderEffect(
    () => ({
      url: router.currentURL().pathname + router.currentURL().search,
      state: router.currentState(),
      historyIndex: router.history.index,
      historyEntries: router.history.entries.map((e) => pathOf(e.href)),
      searchParams: { ...router.searchParams },
    }),
    (info) => {
      if (!debugContent) return;
      const entriesList = info.historyEntries
        .map((path, i) => {
          const marker = i === info.historyIndex ? " ←" : "";
          return `  ${i}: ${path}${marker}`;
        })
        .join("\n");
      debugContent.innerHTML = "";
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
      debugContent.append(dl);
      const pre = document.createElement("pre");
      pre.textContent = entriesList || "(empty)";
      debugContent.append(pre);
    },
  );
});
