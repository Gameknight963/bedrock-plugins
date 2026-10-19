/* Copyright (c) 2025 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-18. See NOTICE. */
import type { MenuChild, RendererContext } from '@bedrock/renderer';

interface Sticker { id: string; format_type: number }
const extensions = ['', 'png', 'png', 'json', 'gif'];

export function start(ctx: RendererContext): void {
    function LinkIcon() {
        return ctx.react.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
            ctx.react.createElement('path', { d: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2' }));
    }
    function add(children: MenuChild[], sticker: Sticker, index: number): void {
        if (!/^\d+$/.test(sticker.id) || !extensions[sticker.format_type]) return;
        const env = (globalThis as typeof globalThis & { GLOBAL_ENV?: { CDN_HOST?: string; MEDIA_PROXY_ENDPOINT?: string } }).GLOBAL_ENV;
        const base = sticker.format_type === 4 ? `https:${env?.MEDIA_PROXY_ENDPOINT || '//media.discordapp.net'}` : `https://${env?.CDN_HOST || 'cdn.discordapp.com'}`;
        const url = `${base}/stickers/${sticker.id}.${extensions[sticker.format_type]}?size=512&lossless=true`;
        const items = [
            ctx.contextMenus.item({ id: 'bedrock-copy-sticker-link', label: 'Copy Sticker Link', leadingAccessory: { type: 'icon', icon: LinkIcon }, async action() {
                try { await navigator.clipboard.writeText(url); if (!ctx.signal.aborted) ctx.notifications.show({ title: 'Link copied!', type: 'success' }); }
                catch (error) { ctx.log.error(error); }
            } }),
            ctx.contextMenus.item({ id: 'bedrock-open-sticker-link', label: 'Open Sticker Link', leadingAccessory: { type: 'icon', icon: LinkIcon }, action() { window.open(url, '_blank'); } })
        ];
        const sample = children.find(child => ctx.react.isValidElement(child) && !child.props.id && Array.isArray(child.props.children));
        const group = ctx.react.isValidElement(sample) ? ctx.react.cloneElement(sample, { key: 'bedrock-sticker-links', children: items }) :
            ctx.react.createElement(ctx.react.Fragment, { key: 'bedrock-sticker-links' }, ...items);
        children.splice(index, 0, group);
    }
    ctx.contextMenus.patch<{ favoriteableId?: string; favoriteableType?: string; message?: { stickerItems?: Sticker[] } }>('message', (children, props) => {
        if (props.favoriteableType !== 'sticker') return;
        const sticker = props.message?.stickerItems?.find(sticker => sticker.id === props.favoriteableId);
        if (sticker) add(children, sticker, Math.max(0, children.length - 1));
    });
    ctx.contextMenus.patch<{ target?: HTMLElement }>('expression-picker', (children, { target }) => {
        if (!target?.dataset.id || String(target.className).includes('lottieCanvas')) return;
        const store = ctx.webpack.find<{ getStickerById(id: string): Sticker | undefined }>(value => typeof value?.getStickerById === 'function');
        const sticker = store?.getStickerById(target.dataset.id);
        if (sticker) add(children, sticker, children.length);
    });
}
