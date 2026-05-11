import { LitElement, html, type TemplateResult, nothing } from "lit";

const TEMPLATES: Record<string, () => TemplateResult> = {
  home: () => html`
    <article>
      <header><h1>Home</h1></header>
      <p>
        This is a kitchen-sink demo of <code>meow-router</code>, <code>meow-route</code>, and
        <code>meow-outlet</code> — composed with <a href="https://lit.dev/">Lit</a>.
      </p>
      <p>
        Click around the sidebar to exercise the features. The
        <strong>Live state</strong> panel updates reactively from the router's signals and stores.
      </p>
      <ul>
        <li>Nested routes with index + dynamic params</li>
        <li>Catch-all 404 fallback</li>
        <li>Reactive search params (per-key)</li>
        <li><code>navigate</code>, <code>replace</code>, history stack</li>
        <li>Browser back/forward integration</li>
      </ul>
    </article>
  `,
  dogs: () => html`
    <article>
      <header><h1>Dogs</h1></header>
      <p>Wrong house.</p>
      <p>
        Sibling-of-cats route. Note that the cats route's
        <code>matched</code> signal flips to <code>false</code> when this one is shown, and the
        live-state panel reflects the change reactively.
      </p>
    </article>
  `,
  about: () => html`
    <article>
      <header><h1>About</h1></header>
      <p>
        This kitchen sink exercises the full surface of <code>meowter</code> from a Lit application.
        Source lives in <code>../../packages/meowter/src/</code>.
      </p>
      <p>
        UI layer: <a href="https://lit.dev/">Lit</a>. Reactivity layer:
        <code>@solidjs/signals@2.0.0-beta.x</code>, bridged into Lit via a small reactive
        controller. Styling: <a href="https://picocss.com/">Pico CSS</a>. Font:
        <a href="https://github.com/dkaoster/lilex">Lilex Variable</a>.
      </p>
    </article>
  `,
  notfound: () => html`
    <article>
      <header><h1>404</h1></header>
      <p>Nothing here — the catch-all route matched.</p>
      <p><a href="/">Back home</a></p>
    </article>
  `,
};

export class RouteStatic extends LitElement {
  static override properties = {
    name: { type: String },
  };

  declare name: string;

  constructor() {
    super();
    this.name = "";
  }

  override createRenderRoot(): HTMLElement {
    return this;
  }

  override render(): TemplateResult | typeof nothing {
    const template = TEMPLATES[this.name];
    return template ? template() : nothing;
  }
}

if (!customElements.get("route-static")) {
  customElements.define("route-static", RouteStatic);
}
