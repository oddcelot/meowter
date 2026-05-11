import { LitElement, html, type TemplateResult } from "lit";

export class RouteCatsIndex extends LitElement {
  override createRenderRoot(): HTMLElement {
    return this;
  }

  override render(): TemplateResult {
    return html`
      <p>
        Pick a cat above. The list below is the index route's content; the
        detail/new views replace it via the nested outlet.
      </p>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Color</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>whiskers</td><td>tabby</td><td>napping</td></tr>
          <tr><td>mittens</td><td>black</td><td>plotting</td></tr>
          <tr><td>biscuit</td><td>orange</td><td>begging</td></tr>
        </tbody>
      </table>
    `;
  }
}

if (!customElements.get("route-cats-index")) {
  customElements.define("route-cats-index", RouteCatsIndex);
}

export class RouteCatNew extends LitElement {
  override createRenderRoot(): HTMLElement {
    return this;
  }

  #onSubmit = (event: Event): void => {
    event.preventDefault();
  };

  override render(): TemplateResult {
    return html`
      <h2>New cat</h2>
      <form @submit=${this.#onSubmit}>
        <label>
          Name
          <input type="text" name="name" placeholder="e.g. Pickles" />
        </label>
        <label>
          Color
          <select name="color">
            <option>tabby</option>
            <option>black</option>
            <option>orange</option>
            <option>calico</option>
          </select>
        </label>
        <button type="submit">Add cat (no-op demo)</button>
      </form>
    `;
  }
}

if (!customElements.get("route-cat-new")) {
  customElements.define("route-cat-new", RouteCatNew);
}
