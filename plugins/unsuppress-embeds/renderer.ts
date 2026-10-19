/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { MenuChild, RendererContext } from '@bedrock/renderer';

interface Message {
    id: string;
    author: { id: string };
    flags: number;
    embeds?: unknown[];
    messageSnapshots?: { message: { embeds?: unknown[] } }[];
}
interface Channel { id: string; isPrivate(): boolean }
const suppressed = 1 << 2;

export function start(ctx: RendererContext): void {
    function groupWithDelete(children: MenuChild[]): MenuChild[] | undefined {
        if (children.some(child => ctx.react.isValidElement(child) && child.props.id === 'delete')) return children;
        for (const child of children) {
            const nested = Array.isArray(child) ? child : ctx.react.isValidElement(child) ? child.props.children : undefined;
            if (Array.isArray(nested)) { const group = groupWithDelete(nested); if (group) return group; }
        }
    }
    function icon(visible: boolean) {
        return function EmbedIcon() {
            return ctx.react.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': true },
                ctx.react.createElement('path', { fill: 'currentColor', d: visible
                    ? 'M5 21q-.825 0-1.413-.587Q3 19.825 3 19V5q0-.825.587-1.413Q4.175 3 5 3h14q.825 0 1.413.587Q21 4.175 21 5v14q0 .825-.587 1.413Q19.825 21 19 21Zm0-2h14V5H5v14Zm1-2h12l-3.75-5-3 4L9 13Zm-1 2V5v14Z'
                    : 'm21 18.15-2-2V5H7.85l-2-2H19q.825 0 1.413.587Q21 4.175 21 5Zm-1.2 4.45L18.2 21H5q-.825 0-1.413-.587Q3 19.825 3 19V5.8L1.4 4.2l1.4-1.4 18.4 18.4ZM6 17l3-4 2.25 3 .825-1.1L5 7.825V19h11.175l-2-2Zm7.425-6.425ZM10.6 13.4Z' }));
        };
    }
    ctx.contextMenus.patch<{ channel?: Channel; message?: Message }>('message', (children, { channel, message }) => {
        if (!channel || !message?.author) return;
        const hidden = (message.flags & suppressed) !== 0;
        if (!hidden && !message.embeds?.length && !message.messageSnapshots?.some(snapshot => snapshot.message.embeds?.length)) return;
        const users = ctx.webpack.find<{ getCurrentUser(): { id: string } | undefined }>(value => value?.getName?.() === 'UserStore');
        const permissions = ctx.webpack.find<{ getChannelPermissions(channel: { id: string }): bigint }>(value => typeof value?.getChannelPermissions === 'function');
        const canEmbed = channel.isPrivate() || Boolean((permissions?.getChannelPermissions(channel) ?? 0n) & 16384n);
        if (message.author.id === users?.getCurrentUser()?.id && !canEmbed) return;
        const group = groupWithDelete(children);
        if (!group) return;
        const item = ctx.contextMenus.item({ id: 'unsuppress-embeds', label: hidden ? 'Unsuppress Embeds' : 'Suppress Embeds',
            color: hidden ? undefined : 'danger', leadingAccessory: { type: 'icon', icon: icon(hidden) }, async action() {
                try {
                    const rest = ctx.webpack.find<{ patch(options: { url: string; body: object }): Promise<unknown> }>(value => typeof value?.patch === 'function' && typeof value?.get === 'function' && typeof value?.del === 'function');
                    if (!rest) throw new Error("Discord's message API is unavailable.");
                    await rest.patch({ url: `/channels/${channel.id}/messages/${message.id}`, body: { flags: hidden ? message.flags & ~suppressed : message.flags | suppressed } });
                } catch (error) {
                    if (ctx.signal.aborted) return;
                    ctx.log.error(error);
                    ctx.notifications.show({ title: 'Could not change message embeds', body: error instanceof Error ? error.message : String(error), type: 'error' });
                }
            } });
        const index = group.findIndex(child => ctx.react.isValidElement(child) && child.props.id === 'delete');
        group.splice(Math.max(0, index - 1), 0, item);
    });
}
