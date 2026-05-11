import { LitElement, html, type TemplateResult } from "lit";
import type { MeowRouter } from "meowter";
import { SignalsController } from "./signals-controller.ts";

export class RouteSearch extends LitElement {
  #filter = "";
  #sort = "";
  #readout = "(none)";

  constructor() {
    super();
    new SignalsController(this, (track) => {
      const router = this.#router();
      if (!router) return;
      track(
        () => router.searchParams["filter"]?.[0] ?? "",
        (filter) => {
          this.#filter = filter;
        },
      );
      track(
        () => router.searchParams["sort"]?.[0] ?? "",
        (sort) => {
          this.#sort = sort;
        },
      );
      track(
        () => JSON.stringify(router.searchParams, null, 2),
        (text) => {
          this.#readout = text === "{}" ? "(none)" : text;
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

  #onFilterInput = (event: Event): void => {
    const value = (event.target as HTMLInputElement).value;
    this.#router()?.setSearchParam("filter", value || null);
  };

  #onSortChange = (event: Event): void => {
    const value = (event.target as HTMLSelectElement).value;
    this.#router()?.setSearchParam("sort", value || null);
  };

  #onAddTag = (): void => {
    const router = this.#router();
    if (!router) return;
    const existing = router.searchParams["tag"] ?? [];
    router.setSearchParam("tag", [...existing, `tag${existing.length + 1}`]);
  };

  #onClear = (): void => {
    const router = this.#router();
    if (!router) return;
    for (const key of Object.keys(router.searchParams)) {
      router.setSearchParam(key, null);
    }
  };

  override render(): TemplateResult {
    return html`
      <article>
        <header><h1>Search params</h1></header>
        <p>
          Type below — each keystroke writes to <code>?filter=</code> via
          <code>router.setSearchParam(...)</code> using
          <code>history: "replace"</code> so back/forward only steps between
          actual page navigations.
        </p>

        <fieldset>
          <label>
            Filter
            <input
              type="text"
              placeholder="filter cats…"
              .value=${this.#filter}
              @input=${this.#onFilterInput}
            />
          </label>
          <label>
            Sort
            <select .value=${this.#sort} @change=${this.#onSortChange}>
              <option value="">(none)</option>
              <option value="asc">ascending</option>
              <option value="desc">descending</option>
            </select>
          </label>
        </fieldset>

        <p>
          <button @click=${this.#onAddTag}>Add tag</button>
          <button class="secondary" @click=${this.#onClear}>Clear all</button>
        </p>

        <p>Current params (live):</p>
        <pre id="search-readout">${this.#readout}</pre>
      </article>
    `;
  }
}

if (!customElements.get("route-search")) {
  customElements.define("route-search", RouteSearch);
}
