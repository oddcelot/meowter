let injected = false;

export function ensureStyle(): void {
  if (injected) return;
  if (typeof document === "undefined") return;
  const style = document.createElement("style");
  style.dataset["meowterFouc"] = "";
  style.textContent =
    "meow-route:not(:defined),meow-outlet:not(:defined){display:none}";
  document.head.appendChild(style);
  injected = true;
}
