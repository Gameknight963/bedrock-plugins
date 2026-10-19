/* Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-18. See NOTICE. */
import type { RendererContext } from '@bedrock/renderer';

export const settings = Bedrock.definePluginSettings({
    copyUnicode: { type: Bedrock.OptionType.BOOLEAN, label: 'Copy Unicode',
        description: 'Copy the Unicode character instead of :name: for standard emoji.', default: true }
});

export function start(ctx: RendererContext): void {
    function CopyIcon() {
        return ctx.react.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
            ctx.react.createElement('rect', { x: 8, y: 8, width: 12, height: 12, rx: 2 }),
            ctx.react.createElement('path', { d: 'M16 8V4H4v12h4' }));
    }
    ctx.contextMenus.patch<{ target?: HTMLElement }>('expression-picker', (children, { target }) => {
        if (target?.dataset.type !== 'emoji') return;
        children.push(ctx.contextMenus.item({ id: 'bedrock-copy-emoji-markdown', label: 'Copy Emoji Markdown',
            leadingAccessory: { type: 'icon', icon: CopyIcon }, async action() {
                try {
                    const { id, name = '' } = target.dataset;
                    let markdown: string;
                    if (id) {
                        const image = target.querySelector('img');
                        const url = new URL(image?.src || '', location.href);
                        const animated = url.pathname.endsWith('.gif') || url.searchParams.get('animated') === 'true';
                        markdown = `<${animated ? 'a' : ''}:${name.replace(/~\d+$/, '')}:${id}>`;
                    } else if (settings.store.copyUnicode) {
                        const emoji = await ctx.webpack.waitFor<{ convertNameToSurrogate(name: string): string }>(value => typeof value?.convertNameToSurrogate === 'function');
                        if (ctx.signal.aborted) return;
                        markdown = emoji.convertNameToSurrogate(name);
                    } else markdown = `:${name}:`;
                    await navigator.clipboard.writeText(markdown);
                    if (!ctx.signal.aborted) ctx.notifications.show({ title: 'Success! Copied emoji markdown.', type: 'success' });
                } catch (error) { if (!ctx.signal.aborted) ctx.log.error(error); }
            } }));
    });
}
