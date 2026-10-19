export function GIFEncoder(): {
    writeFrame(pixels: Uint8Array, width: number, height: number, options: { transparent?: boolean; palette: number[][]; delay?: number }): void;
    finish(): void;
    bytesView(): Uint8Array<ArrayBuffer>;
};
export function quantize(data: Uint8ClampedArray, colors: number): number[][];
export function applyPalette(data: Uint8ClampedArray, palette: number[][]): Uint8Array;
