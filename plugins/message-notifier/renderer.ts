/* Copyright (c) 2025 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-21. See NOTICE. */
import type { RendererContext } from '@bedrock/renderer';
interface Dispatcher { subscribe(name: string, callback: (event: MessageEvent) => void): void; unsubscribe(name: string, callback: (event: MessageEvent) => void): void }
interface MessageEvent { guildId?: string; channelId?: string; message: { id: string; type: number; channel_id: string; guild_id?: string; author: { id: string; username: string; globalName?: string; global_name?: string } } }
let context: RendererContext | undefined;
let unsubscribe: (() => void) | undefined;
export const settings = Bedrock.definePluginSettings({
    users: { label: 'Users', type: Bedrock.OptionType.STRING, description: 'User IDs to notify you about, separated by commas.', default: '',
        isValid(value: string): true | string {
            if (!value.trim()) return true;
            for (const id of value.split(',').map(id => id.trim())) if (!/^\d+$/.test(id)) return `${JSON.stringify(id)} is not a valid user ID.`;
            return true;
        }
    }
});
function find(ctx: RendererContext, predicate: (value: any) => boolean, name: string): any {
    const value = ctx.webpack.find(predicate);
    if (!value) throw new Error(`Message Notifier could not find Discord's ${name}.`);
    return value;
}
export function onMessage(event: MessageEvent): void {
    const ctx = context;
    if (!ctx || ctx.signal.aborted || event.message?.type !== 0) return;
    const { message } = event, channelId = event.channelId ?? message.channel_id;
    if (!settings.store.users.split(',').map(id => id.trim()).includes(message.author.id)) return;
    try {
        const selected = find(ctx, value => typeof value?.getChannelId === 'function' && typeof value?.getLastSelectedChannelId === 'function', 'selected channel store');
        if (selected.getChannelId() === channelId) return;
        const relations = find(ctx, value => typeof value?.getNickname === 'function' && typeof value?.getRelationshipType === 'function', 'relationship store');
        const guildStore = find(ctx, value => typeof value?.getGuild === 'function' && typeof value?.getGuilds === 'function', 'server store');
        const channels = find(ctx, value => typeof value?.getChannel === 'function' && typeof value?.getDMFromUserId === 'function', 'channel store');
        const guild = guildStore.getGuild(event.guildId ?? message.guild_id), channel = channels.getChannel(channelId);
        const username = relations.getNickname(message.author.id) ?? message.author.globalName ?? message.author.global_name ?? message.author.username;
        const locationName = guild ? `${guild.name}#${channel?.name ?? channelId}` : channel?.name || 'their DMs';
        ctx.notifications.show({ title: `${username} sent a message`, body: `Click to jump to ${locationName}`, onClick() {
            if (ctx !== context || ctx.signal.aborted) return;
            find(ctx, value => typeof value === 'function' && String(value).includes('transitionTo -'), 'navigation router')(`/channels/${guild?.id ?? '@me'}/${channelId}/${message.id}`);
        } });
    } catch (error) { ctx.log.error(`Could not show a notification for message ${message.id} in channel ${channelId}.`, error); }
}
export async function start(ctx: RendererContext): Promise<void> {
    context = ctx;
    const flux = await ctx.webpack.waitFor<Dispatcher>(value => typeof value?.dispatch === 'function' && typeof value?.subscribe === 'function');
    if (ctx !== context || ctx.signal.aborted) return;
    flux.subscribe('MESSAGE_CREATE', onMessage);
    unsubscribe = () => flux.unsubscribe('MESSAGE_CREATE', onMessage);
}
export function stop(): void { unsubscribe?.(); unsubscribe = undefined; context = undefined; }
