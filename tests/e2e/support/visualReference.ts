import { mkdir } from 'node:fs/promises';
import type { Locator } from '@playwright/test';

export interface PanelVisualEvidence {
  readonly background: string;
  readonly canvasCount: number;
  readonly canvasDimensions: ReadonlyArray<{ height: number; width: number }>;
  readonly height: number;
  readonly legend: string;
  readonly pixels: readonly number[];
  readonly plotHeight: number;
  readonly plotWidth: number;
  readonly title: string;
  readonly width: number;
}

export async function capturePanelVisual(
  panel: Locator,
  screenshotName: string
): Promise<PanelVisualEvidence> {
  await mkdir('artifacts/playwright', { recursive: true });
  await panel.screenshot({ path: `artifacts/playwright/${screenshotName}.png` });
  return panel.evaluate((element) => {
    const panelRect = element.getBoundingClientRect();
    const plot = element.querySelector<HTMLElement>('.uplot');
    const plotRect = plot?.getBoundingClientRect();
    const canvases = [...element.querySelectorAll<HTMLCanvasElement>('canvas')];
    const sampleWidth = 120;
    const sampleHeight = 60;
    const composite = document.createElement('canvas');
    composite.width = Math.max(1, Math.round(plotRect?.width ?? panelRect.width));
    composite.height = Math.max(1, Math.round(plotRect?.height ?? panelRect.height));
    const context = composite.getContext('2d', { willReadFrequently: true })!;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, composite.width, composite.height);
    for (const canvas of canvases) {
      const rect = canvas.getBoundingClientRect();
      context.drawImage(
        canvas,
        rect.left - (plotRect?.left ?? panelRect.left),
        rect.top - (plotRect?.top ?? panelRect.top),
        rect.width,
        rect.height
      );
    }
    const sample = document.createElement('canvas');
    sample.width = sampleWidth;
    sample.height = sampleHeight;
    const sampleContext = sample.getContext('2d', { willReadFrequently: true })!;
    sampleContext.drawImage(composite, 0, 0, sampleWidth, sampleHeight);
    return {
      background: getComputedStyle(element).backgroundColor,
      canvasCount: canvases.length,
      canvasDimensions: canvases.map((canvas) => ({ height: canvas.height, width: canvas.width })),
      height: panelRect.height,
      legend: [...element.querySelectorAll('li,[role="listitem"]')]
        .map((item) => item.textContent?.trim() ?? '')
        .join(' | '),
      pixels: [...sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data],
      plotHeight: plotRect?.height ?? 0,
      plotWidth: plotRect?.width ?? 0,
      title: element.querySelector('h1,h2,h3,h4,h5,h6')?.textContent?.trim() ?? '',
      width: panelRect.width,
    };
  });
}

export function compareStablePixels(
  first: PanelVisualEvidence,
  second: PanelVisualEvidence
): { readonly comparedPixels: number; readonly differingPixels: number; readonly ratio: number } {
  let comparedPixels = 0;
  let differingPixels = 0;
  const length = Math.min(first.pixels.length, second.pixels.length);
  for (let index = 0; index + 3 < length; index += 4) {
    const firstLight = Math.min(
      first.pixels[index]!,
      first.pixels[index + 1]!,
      first.pixels[index + 2]!
    );
    const secondLight = Math.min(
      second.pixels[index]!,
      second.pixels[index + 1]!,
      second.pixels[index + 2]!
    );
    // Text and the moving series are intentionally masked. The common light
    // plot background is the stable region used for the objective threshold.
    if (firstLight < 250 || secondLight < 250) continue;
    comparedPixels += 1;
    if (
      Math.max(
        Math.abs(first.pixels[index]! - second.pixels[index]!),
        Math.abs(first.pixels[index + 1]! - second.pixels[index + 1]!),
        Math.abs(first.pixels[index + 2]! - second.pixels[index + 2]!)
      ) > 3
    ) {
      differingPixels += 1;
    }
  }
  return {
    comparedPixels,
    differingPixels,
    ratio: comparedPixels === 0 ? 1 : differingPixels / comparedPixels,
  };
}
