import { LitElement, html, type TemplateResult } from "lit";
import type { MeowRouter } from "meowter";
import { SignalsController } from "./signals-controller.ts";

interface DebugInfo {
  url: string;
  state: string;
  historyIndex: number;
  historyEntries: string[];
}

function pathOf(href: string): string {
  const u = new URL(href, window.location.origin);
  return u.pathname + u.search;
}

export class DebugPanel extends LitElement {
  #info: DebugInfo = {
    url: "",
    state: "null",
    historyIndex: 0,
    historyEntries: [],
  };

  constructor() {
    super();
    new SignalsController(this, (track) => {
      const router = this.#router();
      if (!router) return;
      track(
        () => ({
          url: router.currentURL().pathname + router.currentURL().search,
          state: JSON.stringify(router.currentState()),
          historyIndex: router.history.index,
          historyEntries: router.history.entries.map((e) => pathOf(e.href)),
        }),
        (info) => {
          this.#info = info;
        },
      );
    });
  }

  override createRenderRoot(): HTMLElement {
    return this;
  }

  #router(): MeowRouter | null {
    return this.closest<MeowRouter>("meow-router");
  }

  override render(): TemplateResult {
    const { url, state, historyIndex, historyEntries } = this.#info;
    const stack =
      historyEntries
        .map(
          (path, i) => `  ${i}: ${path}${i === historyIndex ? " ←" : ""}`,
        )
        .join("\n") || "(empty)";
    return html`
      <article id="debug">
        <header><strong>Live state</strong></header>
        <div id="debug-content">
          <dl>
            <dt>URL</dt>
            <dd>${url}</dd>
            <dt>State</dt>
            <dd>${state}</dd>
            <dt>History</dt>
            <dd>${historyIndex + 1} / ${historyEntries.length}</dd>
          </dl>
          <pre>${stack}</pre>
        </div>
      </article>
    `;
  }
}

if (!customElements.get("debug-panel")) {
  customElements.define("debug-panel", DebugPanel);
}
