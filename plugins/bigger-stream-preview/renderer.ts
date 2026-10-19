/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, MenuChild } from '@bedrock/renderer';
type Stream = { guildId?: string | null; channelId: string; ownerId: string };
let context: RendererContext;
let disposers: (() => void)[] = [];
function find<T>(predicate: (value: any) => boolean): T {
    const value = context.webpack.find<T>(predicate);
    if (!value) throw new Error('A Discord module needed by Bigger Stream Preview has not loaded.');
    return value;
}
function ScreenshareIcon(props: Record<string, unknown>): unknown {
    return context.react.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', ...props },
        context.react.createElement('path', { fill: 'currentColor', d: 'M2 4.5C2 3.397 2.897 2.5 4 2.5H20C21.103 2.5 22 3.397 22 4.5V15.5C22 16.604 21.103 17.5 20 17.5H13V19.5H17V21.5H7V19.5H11V17.5H4C2.897 17.5 2 16.604 2 15.5V4.5ZM13.2 14.3375V11.6C9.864 11.6 7.668 12.6625 6 15C6.672 11.6625 8.532 8.3375 13.2 7.6625V5L18 9.6625L13.2 14.3375Z' }));
}
export async function handleViewPreview(stream: Stream): Promise<void> {
    const ctx = context;
    try {
        const preview = find<{ getPreviewURL(guildId: string | null | undefined, channelId: string, ownerId: string): string | undefined | Promise<string | undefined> }>(value => typeof value?.getPreviewURL === 'function');
        const url = await preview.getPreviewURL(stream.guildId, stream.channelId, stream.ownerId);
        if (!url || ctx.signal.aborted) return;
        const predicate = (value: any) => typeof value === 'function' && String(value).includes('hasMediaOptions') && String(value).includes('shouldHideMediaOptions');
        if (!ctx.webpack.find(predicate)) await ctx.webpack.loadChunks({ find: ['hasMediaOptions', 'shouldHideMediaOptions'] });
        if (ctx.signal.aborted) return;
        find<(props: unknown) => void>(predicate)({ items: [{ type: 'IMAGE', original: url, url, width: 1280, height: 720 }] });
    } catch (error) {
        if (ctx.signal.aborted) return;
        ctx.log.error('Could not open the stream preview.', error);
        ctx.notifications.show({ title: 'Could not open the stream preview', body: error instanceof Error ? error.message : String(error), type: 'error' });
    }
}
function addPreview(children: MenuChild[], ownerId: string | undefined): void {
    if (!ownerId || context.signal.aborted) return;
    const stream = find<{ getAnyStreamForUser(id: string): Stream | undefined }>(value => typeof value?.getAnyStreamForUser === 'function').getAnyStreamForUser(ownerId);
    if (!stream) return;
    const menu = context.webpack.find<{ MenuSeparator: unknown }>(value => value?.MenuSeparator && value?.MenuItem);
    if (menu) children.push(context.react.createElement(menu.MenuSeparator, null));
    children.push(context.contextMenus.item({ id: 'view-stream-preview', label: 'View Stream Preview', icon: ScreenshareIcon, leadingAccessory: { type: 'icon', icon: ScreenshareIcon }, action: () => { void handleViewPreview(stream); } }));
}
export function start(ctx: RendererContext): void {
    context = ctx;
    disposers = [ctx.contextMenus.patch<{ user?: { id: string } }>('user-context', (children, props) => addPreview(children, props.user?.id)),
        ctx.contextMenus.patch<{ stream?: Stream }>('stream-context', (children, props) => addPreview(children, props.stream?.ownerId))];
}
export function stop(): void { for (const dispose of disposers.splice(0)) dispose(); }
