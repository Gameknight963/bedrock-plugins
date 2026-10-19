/* Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { SourcePatch } from '@bedrock/renderer';

export const settings = Bedrock.definePluginSettings({
    originalImagesInChat: { type: Bedrock.OptionType.BOOLEAN, label: 'Original Images in Chat', description: 'Load originals in chat too. This uses more bandwidth and may cause lag; animated images may keep playing when Discord is unfocused.', default: false }
});
export const patches: SourcePatch[] = [{ id: 'attachment-image-source', find: '.handleImageLoad)', replacement: {
    match: /getSrc\([A-Za-z_$][\w$]*\)\{/, replace: '$&var _bedrockImageSrc=$self.getSrc(this?.props,arguments[1]);if(_bedrockImageSrc)return _bedrockImageSrc;'
} }];
interface ImageProps { src: string; width: number; height: number; contentType?: string; mosaicStyleAlt?: boolean; trigger?: string }
export function getSrc(props?: ImageProps, freeze?: boolean): string | undefined {
    if (!props?.src) return;
    const { src, contentType, width, height, mosaicStyleAlt, trigger } = props;
    if (!(contentType?.startsWith('image/') ?? (typeof mosaicStyleAlt === 'boolean'))) return;
    try {
        const url = new URL(src);
        if (!['media.discordapp.net', 'cdn.discordapp.com'].includes(url.hostname) || !url.pathname.startsWith('/attachments/')) return;
        url.searchParams.set('animated', String(!freeze));
        if (freeze && url.pathname.endsWith('.gif')) url.searchParams.set('format', 'webp');
        if (!settings.store.originalImagesInChat && !trigger) {
            const pixels = width * height;
            if (pixels > 2400000) {
                const scale = Math.sqrt(pixels / 2400000);
                url.searchParams.set('width', String(Math.round(width / scale)));
                url.searchParams.set('height', String(Math.round(height / scale)));
            } else {
                url.searchParams.delete('width');
                url.searchParams.delete('height');
            }
        } else {
            url.hostname = 'cdn.discordapp.com';
            url.searchParams.delete('width');
            url.searchParams.delete('height');
        }
        return url.href;
    } catch { return; }
}
export function start(): void {}
