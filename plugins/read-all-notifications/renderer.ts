/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { MenuElement, RendererContext, SourcePatch } from '@bedrock/renderer';

interface ChannelEntry { channel: { id: string } }
interface GuildChannels { SELECTABLE?: ChannelEntry[]; VOCAL?: ChannelEntry[] }
interface ReadStates { hasUnread(id: string): boolean; lastMessageId(id: string): string | null }
let context: RendererContext;
export const patches: SourcePatch[] = [{ id: 'server-list-read-all-button', find: 'Be8Q5E', replacement: {
    match: /(?<=Be8Q5E.+?return)([\[(].{0,150}?tutorialId:"friends-list".+?)(?=}function)/,
    replace: '[$1,$self.renderReadAllButton()]'
} }];

export function readAll(): void {
    const ctx = context;
    if (!ctx || ctx.signal.aborted) return;
    const guilds = ctx.webpack.find<{ getGuilds(): Record<string, { id: string }> }>(value => value?.getName?.() === 'GuildStore');
    const guildChannels = ctx.webpack.find<{ getChannels(id: string): GuildChannels }>(value => value?.getName?.() === 'GuildChannelStore');
    const threads = ctx.webpack.find<{ getActiveJoinedThreadsForGuild(id: string): Record<string, Record<string, ChannelEntry>> }>(value => typeof value?.getActiveJoinedThreadsForGuild === 'function');
    const states = ctx.webpack.find<ReadStates>(value => value?.getName?.() === 'ReadStateStore');
    const dispatcher = ctx.webpack.find<{ dispatch(event: object): void }>(value => typeof value?.dispatch === 'function' && typeof value?.subscribe === 'function');
    if (!guilds || !guildChannels || !threads || !states || !dispatcher) throw new Error("Discord's unread channel stores are unavailable.");
    const unread = new Map<string, { channelId: string; messageId: string | null; readStateType: number }>();
    for (const guild of Object.values(guilds.getGuilds())) {
        const channels = guildChannels.getChannels(guild.id);
        const joined = Object.values(threads.getActiveJoinedThreadsForGuild(guild.id) ?? {}).flatMap(group => Object.values(group));
        for (const entry of [...channels.SELECTABLE ?? [], ...channels.VOCAL ?? [], ...joined]) {
            const id = entry.channel?.id;
            if (!id || !states.hasUnread(id)) continue;
            unread.set(id, { channelId: id, messageId: states.lastMessageId(id), readStateType: 0 });
        }
    }
    if (unread.size) dispatcher.dispatch({ type: 'BULK_ACK', context: 'APP', channels: [...unread.values()] });
}

export function renderReadAllButton(): MenuElement | null {
    if (!context || context.signal.aborted) return null;
    return context.react.createElement('button', { key: 'bedrock-read-all', className: 'vc-text-btn-base vc-text-btn-secondary vc-ranb-button', onClick() {
        try { readAll(); }
        catch (error) {
            context.log.error(error);
            context.notifications.show({ title: 'Could not mark notifications as read', body: error instanceof Error ? error.message : String(error), type: 'error' });
        }
    } }, 'Read All');
}

export function start(ctx: RendererContext): void {
    context = ctx;
    ctx.styles.add(`
        .vc-ranb-button { appearance:none; background:none; border:0; border-radius:3px; cursor:pointer;
            font:inherit; font-weight:400; text-align:start; text-decoration:none; max-width:100%;
            color:var(--interactive-icon-default); padding:0 .5em; width:100%; font-size:14px; white-space:nowrap; box-sizing:border-box; }
        .vc-ranb-button:hover { color:var(--interactive-icon-active); text-decoration:underline; }
        .vc-ranb-button:focus-visible { box-shadow:0 0 0 4px var(--border-focus,#00b0f4); }
    `);
}
