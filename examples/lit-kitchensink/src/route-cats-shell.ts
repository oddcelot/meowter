import "meowter";
import { html, type TemplateResult } from "lit";
import { catDetailRoute, catNewRoute, catsRoute } from "./routes.ts";

/**
 * Shared chrome for every `/cats/...` sub-route: the article + sub-nav header.
 * The sub-nav uses `<meow-link>` with typed Route references so the URL is
 * built from `route.fullPath` + `params` instead of hand-written strings.
 */
export function catsShell(content: TemplateResult): TemplateResult {
  return html`
    <article>
      <header>
        <h1>Cats</h1>
        <nav>
          <ul>
            <li><meow-link .to=${catsRoute} exact>All</meow-link></li>
            <li><meow-link .to=${catNewRoute}>New</meow-link></li>
            <li>
              <meow-link .to=${catDetailRoute} .params=${{ id: "whiskers" }}> Whiskers </meow-link>
            </li>
            <li>
              <meow-link .to=${catDetailRoute} .params=${{ id: "mittens" }}> Mittens </meow-link>
            </li>
            <li>
              <meow-link .to=${catDetailRoute} .params=${{ id: "biscuit" }}> Biscuit </meow-link>
            </li>
          </ul>
        </nav>
      </header>
      ${content}
    </article>
  `;
}
