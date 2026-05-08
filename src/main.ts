import "./router.ts";

const router = document.querySelector("meow-router");
const log = document.querySelector<HTMLPreElement>("#log");

if (router && log) {
  router.addEventListener("route-change", (event) => {
    const line = `${new Date().toISOString().slice(11, 19)}  ${event.detail.url.pathname}${event.detail.url.search}${event.detail.url.hash}`;
    log.textContent = `${line}\n${log.textContent ?? ""}`;
  });
}
