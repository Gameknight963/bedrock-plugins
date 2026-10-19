/* Copyright (c) 2025 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { Disposer, RendererContext, SourcePatch } from '@bedrock/renderer';

let removeStyle: Disposer | undefined;
let unsubscribe: Disposer | undefined;
export const settings = Bedrock.definePluginSettings({
    blurAmount: { type: Bedrock.OptionType.NUMBER, label: 'Blur strength', description: 'Blur radius in pixels.', default: 10, min: 0 },
    blurAllChannels: { type: Bedrock.OptionType.BOOLEAN, label: 'Blur all channels', description: 'Blur attachments in every channel, rather than only age-restricted channels.', default: false }
});
const identifier = '(?:[A-Za-z_$][\\w$]*)';
export const patches: SourcePatch[] = [{ id: 'attachment-blur-classes', find: '}renderStickersAccessories(', replacement: {
    match: new RegExp(String.raw`(\.renderReactions\(\i\).+?className:)`.replaceAll('\\i', identifier)),
    replace: '$&$self.attachmentClasses(this?.props?.channel)+'
} }];

export function attachmentClasses(channel: { nsfw?: boolean } | undefined): string {
    return `vc-blur-attachments ${channel?.nsfw ? 'vc-nsfw-img ' : ''}`;
}
export function blurCss(): string {
    const root = settings.store.blurAllChannels ? '.vc-blur-attachments' : '.vc-nsfw-img';
    return `
        ${root} [class*=imageContainer] img, ${root} [class*=imageContainer] video,
        ${root} [class*=wrapperPaused] img, ${root} [class*=wrapperPaused] video {
            filter:blur(${settings.store.blurAmount}px); transition:filter .2s; }
        ${root} [class*=imageContainer]:hover img, ${root} [class*=imageContainer]:hover video,
        ${root} [class*=wrapperPaused]:hover img, ${root} [class*=wrapperPaused]:hover video { filter:blur(0); }
    `;
}
export function start(ctx: RendererContext): void {
    function update(): void { removeStyle?.(); removeStyle = ctx.styles.add(blurCss()); }
    update();
    unsubscribe = settings.subscribe(update);
}
export function stop(): void {
    unsubscribe?.(); unsubscribe = undefined;
    removeStyle?.(); removeStyle = undefined;
}
