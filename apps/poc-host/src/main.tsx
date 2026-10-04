import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { App } from './App';
import './host.css';

let hostRoot: Root | undefined;

export function mountPocHost(element: HTMLElement): void {
  if (hostRoot) {
    throw new Error('The disposable POC host already has an active React root.');
  }

  hostRoot = createRoot(element);
  hostRoot.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

export function unmountPocHost(): void {
  hostRoot?.unmount();
  hostRoot = undefined;
}

const mountElement = document.querySelector<HTMLElement>('#root');

if (!mountElement) {
  throw new Error('The disposable POC host requires exactly one #root mount element.');
}

mountPocHost(mountElement);

if (import.meta.hot) {
  import.meta.hot.dispose(unmountPocHost);
}
