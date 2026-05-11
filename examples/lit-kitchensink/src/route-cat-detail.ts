import { LitElement, html, type TemplateResult } from "lit";

export class RouteCatDetail extends LitElement {
  static override properties = {
    id: { type: String },
  };

  declare id: string;

  constructor() {
    super();
    this.id = "";
  }

  override createRenderRoot(): HTMLElement {
    return this;
  }

  override render(): TemplateResult {
    return html`
      <h2>Detail: <span>${this.id}</span></h2>
      <p>
        This route demonstrates a dynamic parameter. The <code>:id</code>
        segment is exposed via the route's typed
        <code>useParams()</code> accessor.
      </p>
      <p>
        The Lit component receives <code>id</code> as a property, set by the
        <code>render</code> function inside an effect that re-runs whenever
        <code>params()</code> changes.
      </p>
    `;
  }
}

if (!customElements.get("route-cat-detail")) {
  customElements.define("route-cat-detail", RouteCatDetail);
}
