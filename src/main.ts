import "./index.ts";

document.querySelectorAll<HTMLElement>("meow-route").forEach((route) => {
  route.addEventListener("route-match", (event) => {
    for (const target of route.querySelectorAll<HTMLElement>("[data-param]")) {
      const name = target.dataset["param"];
      if (name) target.textContent = event.detail.params[name] ?? "";
    }
  });
});
