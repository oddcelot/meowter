export function shouldInterceptLinkClick(event: MouseEvent): URL | null {
  if (event.defaultPrevented) return null;
  if (event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;

  const target = event.target;
  if (!(target instanceof Element)) return null;

  const anchor = target.closest("a");
  if (!anchor) return null;

  const href = anchor.getAttribute("href");
  if (href === null) return null;

  const targetAttr = anchor.getAttribute("target");
  if (targetAttr !== null && targetAttr !== "_self") return null;

  if (anchor.hasAttribute("download")) return null;

  const rel = anchor.getAttribute("rel");
  if (rel !== null && rel.split(/\s+/).includes("external")) return null;

  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) return null;

  return url;
}
