import { createMemo, untrack, type Accessor } from "@solidjs/signals";
import type {
  AnyRoute,
  NavigatePathOptions,
  NavigateRouteOptions,
  Router,
} from "./create-route.ts";
import { computeHref } from "./create-route.ts";
import { MeowRouter } from "./router-element.ts";

export interface ActiveOptions {
  /** If true, match only when the current pathname exactly equals the link's pathname. */
  exact?: boolean;
}

export type LinkOptions<R extends AnyRoute> = NavigateRouteOptions<R> & {
  activeOptions?: ActiveOptions;
};

export type LinkPathOptions<Tree extends AnyRoute> = NavigatePathOptions<Tree> & {
  activeOptions?: ActiveOptions;
};

export interface LinkHandle {
  /** Pre-computed `href` to set on an `<a>` element. */
  readonly href: string;
  /**
   * Click handler that intercepts plain left-click (no modifier keys) and
   * routes through `router.navigate`/`router.replace`. Modifier-key clicks
   * (cmd / ctrl / shift / alt) and non-primary buttons fall through to the
   * browser, preserving cmd-click-to-open-in-new-tab.
   */
  readonly onClick: (event: MouseEvent) => void;
  /** Reactive accessor — true when the current URL matches the link's target. */
  readonly isActive: Accessor<boolean>;
}

function isModifiedClick(event: MouseEvent): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function pathnameOf(href: string): string {
  try {
    return new URL(href, "http://_meowter").pathname;
  } catch {
    return href;
  }
}

/**
 * Build a typed link handle for a route or path. The returned `href` and
 * `onClick` can be spread onto any `<a>` element to get type-safe, intercepted
 * navigation with the same active-state semantics as a built-in router link.
 */
export function createLink<R extends AnyRoute>(
  router: Router<AnyRoute>,
  opts: LinkOptions<R>,
): LinkHandle;
export function createLink<Tree extends AnyRoute>(
  router: Router<Tree>,
  opts: LinkPathOptions<Tree>,
): LinkHandle;
// Implementation signature widened to `any` for opts so both overloads assign.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLink(router: Router<AnyRoute>, opts: any): LinkHandle {
  const href = computeHref(opts as NavigateRouteOptions<AnyRoute>);
  const targetPath = pathnameOf(href);
  const exact = opts.activeOptions?.exact ?? false;

  const onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented) return;
    if (isModifiedClick(event)) return;
    event.preventDefault();
    if (opts.replace) router.replace(opts as never);
    else router.navigate(opts as never);
  };

  const isActive = createMemo<boolean>(() => {
    const current = router.currentURL().pathname;
    if (exact) return current === targetPath;
    if (targetPath === "/") return current === "/";
    return current === targetPath || current.startsWith(targetPath + "/");
  });

  return { href, onClick, isActive };
}

// ---------------------------------------------------------------------------
// <meow-link> custom element
// ---------------------------------------------------------------------------

/**
 * Custom element that renders a typed link as an `<a>` and intercepts clicks
 * through the closest ancestor `<meow-router>`. Set the target via the `to`
 * attribute (path string), or via the `.to` property (Route value or string),
 * with optional `.params` / `.search` / `.hash` properties.
 *
 * When the link's target path matches the current location, the rendered
 * `<a>` carries `aria-current="page"` and `data-status="active"`.
 */
export class MeowLink extends HTMLElement {
  static observedAttributes = ["to", "replace", "exact"];

  #anchor: HTMLAnchorElement | null = null;
  #router: MeowRouter | null = null;
  #onRouteChange: (() => void) | null = null;
  #onClick: ((event: MouseEvent) => void) | null = null;
  #to: AnyRoute | string = "";
  #params: Record<string, string | number | boolean> | undefined;
  #search: NavigateRouteOptions<AnyRoute>["search"];
  #hash: string | undefined;
  #state: unknown;
  #replace = false;
  #exact = false;

  get to(): AnyRoute | string {
    return this.#to;
  }
  set to(v: AnyRoute | string) {
    this.#to = v;
    this.#update();
  }

  get params(): Record<string, string | number | boolean> | undefined {
    return this.#params;
  }
  set params(v: Record<string, string | number | boolean> | undefined) {
    this.#params = v;
    this.#update();
  }

  get search(): NavigateRouteOptions<AnyRoute>["search"] {
    return this.#search;
  }
  set search(v: NavigateRouteOptions<AnyRoute>["search"]) {
    this.#search = v;
    this.#update();
  }

  get hash(): string | undefined {
    return this.#hash;
  }
  set hash(v: string | undefined) {
    this.#hash = v;
    this.#update();
  }

  get state(): unknown {
    return this.#state;
  }
  set state(v: unknown) {
    this.#state = v;
  }

  get replace(): boolean {
    return this.#replace;
  }
  set replace(v: boolean) {
    this.#replace = v;
  }

  get exact(): boolean {
    return this.#exact;
  }
  set exact(v: boolean) {
    this.#exact = v;
    this.#update();
  }

  connectedCallback(): void {
    if (!this.#anchor) {
      this.#anchor = document.createElement("a");
      // Move existing light-DOM children into the anchor so consumers can write
      // `<meow-link to="/foo">label</meow-link>` and the text is rendered as
      // anchor content.
      while (this.firstChild) this.#anchor.appendChild(this.firstChild);
      this.appendChild(this.#anchor);
    }
    if (!this.#to) {
      const attr = this.getAttribute("to");
      if (attr) this.#to = attr;
    }
    this.#replace ||= this.hasAttribute("replace");
    this.#exact ||= this.hasAttribute("exact");

    this.#router = this.closest<MeowRouter>("meow-router");
    if (this.#router) {
      this.#onRouteChange = (): void => this.#refreshActive();
      this.#router.addEventListener("route-change", this.#onRouteChange);
    }

    if (this.#replace) {
      this.#onClick = (event: MouseEvent): void => {
        if (event.defaultPrevented) return;
        if (isModifiedClick(event)) return;
        const anchor = this.#anchor;
        if (!anchor?.hasAttribute("href")) return;
        event.preventDefault();
        event.stopPropagation();
        this.#router?.replace(anchor.getAttribute("href")!, this.#state);
      };
      this.#anchor.addEventListener("click", this.#onClick);
    }

    this.#update();
  }

  disconnectedCallback(): void {
    if (this.#router && this.#onRouteChange) {
      this.#router.removeEventListener("route-change", this.#onRouteChange);
    }
    if (this.#anchor && this.#onClick) {
      this.#anchor.removeEventListener("click", this.#onClick);
    }
    this.#router = null;
    this.#onRouteChange = null;
    this.#onClick = null;
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "to" && typeof this.#to === "string") {
      this.#to = value ?? "";
      this.#update();
    } else if (name === "replace") {
      this.#replace = value !== null;
    } else if (name === "exact") {
      this.#exact = value !== null;
      this.#update();
    }
  }

  #update(): void {
    const anchor = this.#anchor;
    if (!anchor) return;
    if (!this.#to) {
      anchor.removeAttribute("href");
      return;
    }
    try {
      const href = computeHref({
        to: this.#to,
        params: this.#params,
        search: this.#search,
        hash: this.#hash,
      } as NavigateRouteOptions<AnyRoute>);
      anchor.setAttribute("href", href);
      this.#refreshActive();
    } catch {
      // missing params — strip href until set
      anchor.removeAttribute("href");
    }
  }

  #refreshActive(): void {
    const anchor = this.#anchor;
    if (!anchor) return;
    const router = this.#router ?? this.closest<MeowRouter>("meow-router");
    const href = anchor.getAttribute("href");
    if (!router || !href) {
      anchor.removeAttribute("aria-current");
      anchor.removeAttribute("data-status");
      return;
    }
    // Active state is refreshed via route-change events; explicitly untrack
    // the URL read so we don't pollute any enclosing reactive scope.
    const current = untrack(() => router.currentURL().pathname);
    const targetPath = pathnameOf(href);
    const active = this.#exact
      ? current === targetPath
      : targetPath === "/"
        ? current === "/"
        : current === targetPath || current.startsWith(targetPath + "/");
    if (active) {
      anchor.setAttribute("aria-current", "page");
      anchor.setAttribute("data-status", "active");
    } else {
      anchor.removeAttribute("aria-current");
      anchor.removeAttribute("data-status");
    }
  }
}

if (!customElements.get("meow-link")) {
  customElements.define("meow-link", MeowLink);
}
