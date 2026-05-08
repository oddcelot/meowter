import { createRenderEffect, createRoot } from "@solidjs/signals";
import "./index.ts";
import type { MeowRouter } from "./router-element.ts";

document.querySelectorAll<HTMLElement>("meow-route").forEach((route) => {
  route.addEventListener("route-match", (event) => {
    for (const target of route.querySelectorAll<HTMLElement>("[data-param]")) {
      const name = target.dataset["param"];
      if (name) target.textContent = event.detail.params[name] ?? "";
    }
  });
});

const router = document.querySelector<MeowRouter>("meow-router");
if (router) {
  const filterInput = document.querySelector<HTMLInputElement>("#filter");
  const filterStatus = document.querySelector<HTMLParagraphElement>("#filter-status");
  const historyList = document.querySelector<HTMLOListElement>("#history-list");
  const searchList = document.querySelector<HTMLPreElement>("#search-list");

  filterInput?.addEventListener("input", () => {
    const value = filterInput.value.trim();
    router.setSearchParam("filter", value === "" ? null : value);
  });

  createRoot(() => {
    createRenderEffect(
      () => router.searchParams.filter?.[0] ?? "",
      (filter) => {
        if (filterInput && filterInput.value !== filter) filterInput.value = filter;
        if (filterStatus) {
          filterStatus.textContent = filter
            ? `(filter applied: "${filter}")`
            : "";
        }
      },
    );

    createRenderEffect(
      () => ({
        entries: router.history.entries.map((e) => ({
          id: e.id,
          path:
            new URL(e.href, window.location.origin).pathname +
            new URL(e.href, window.location.origin).search,
        })),
        index: router.history.index,
      }),
      ({ entries, index }) => {
        if (!historyList) return;
        historyList.replaceChildren(
          ...entries.map((e, i) => {
            const li = document.createElement("li");
            li.textContent = `${e.path}${i === index ? " ← current" : ""}`;
            if (i === index) li.classList.add("active");
            return li;
          }),
        );
      },
    );

    createRenderEffect(
      () => JSON.stringify(router.searchParams, null, 2),
      (text) => {
        if (searchList) searchList.textContent = text === "{}" ? "(none)" : text;
      },
    );
  });
}
