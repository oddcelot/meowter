import {
  createRenderEffect,
  createRoot,
  runWithOwner,
} from "@solidjs/signals";
import type { ReactiveController, ReactiveControllerHost } from "lit";

export type Track = <T>(read: () => T, effect: (value: T) => void) => void;

export class SignalsController implements ReactiveController {
  #host: ReactiveControllerHost;
  #setup: (track: Track) => void;
  #dispose: (() => void) | null = null;

  constructor(host: ReactiveControllerHost, setup: (track: Track) => void) {
    this.#host = host;
    this.#setup = setup;
    host.addController(this);
  }

  hostConnected(): void {
    this.#dispose = runWithOwner(null, () =>
      createRoot((dispose) => {
        this.#setup((read, effect) =>
          createRenderEffect(read, (value) => {
            effect(value);
            this.#host.requestUpdate();
          }),
        );
        return dispose;
      }),
    );
  }

  hostDisconnected(): void {
    this.#dispose?.();
    this.#dispose = null;
  }
}
