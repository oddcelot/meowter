import { LitElement, html, type TemplateResult } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import type { MeowRouter } from "meowter";
import { SignalsController } from "./signals-controller.ts";

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

function isActive(linkPath: string, currentPath: string): boolean {
  if (linkPath === "/") return currentPath === "/";
  return currentPath === linkPath || currentPath.startsWith(linkPath + "/");
}

export class AppNav extends LitElement {
  #pathname = "/";

  constructor() {
    super();
    new SignalsController(this, (track) => {
      const router = this.#router();
      if (!router) return;
      track(
        () => router.matchURL().pathname,
        (pathname) => {
          this.#pathname = pathname;
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
    return html`
      <nav aria-label="Primary">
        <ul>
          ${LINKS.map(
            (link) => html`
              <li>
                <a
                  href=${link.href}
                  data-nav
                  aria-current=${ifDefined(isActive(link.href, this.#pathname) ? "page" : undefined)}
                  >${link.label}</a
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
