import { html, type TemplateResult } from "lit";

/** Shared chrome for every `/cats/...` sub-route: the article + sub-nav header. */
export function catsShell(content: TemplateResult): TemplateResult {
  return html`
    <article>
      <header>
        <h1>Cats</h1>
        <nav>
          <ul>
            <li><a href="/cats">All</a></li>
            <li><a href="/cats/new">New</a></li>
            <li><a href="/cats/whiskers">Whiskers</a></li>
            <li><a href="/cats/mittens">Mittens</a></li>
            <li><a href="/cats/biscuit">Biscuit</a></li>
          </ul>
        </nav>
      </header>
      ${content}
    </article>
  `;
}
