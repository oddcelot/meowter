import "meowter";
import { LitElement, html, type TemplateResult } from "lit";

interface NavLink {
  href: string;
  label: string;
}

const LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/cats", label: "Cats" },
  { href: "/dogs", label: "Dogs" },
  { href: "/search", label: "Search params" },
  { href: "/programmatic", label: "Programmatic" },
  { href: "/about", label: "About" },
];

/**
 * Sidebar nav. `<meow-link>` handles the `aria-current="page"` toggling
 * natively — no SignalsController needed.
 */
export class AppNav extends LitElement {
  override createRenderRoot(): HTMLElement {
    return this;
  }

  override render(): TemplateResult {
    return html`
      <nav aria-label="Primary">
        <ul>
          <li><meow-link to="/cats/:id" .params=${{ id: "234" }}>test</meow-link></li>
          ${LINKS.map(
            (link) => html`
              <li>
                <meow-link to=${link.href} data-nav ?exact=${link.href === "/"}
                  >${link.label}</meow-link
                >
              </li>
            `,
          )}
        </ul>
      </nav>
    `;
  }
}

if (!customElements.get("app-nav")) {
  customElements.define("app-nav", AppNav);
}
