/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext } from '@bedrock/renderer';

interface Message { id: string; channel_id: string; content: string; author: { id: string }; type: number; flags?: number; deleted?: boolean; hasFlag?(flag: number): boolean }
interface Channel { id: string; guild_id?: string; isPrivate?(): boolean }
interface Dispatcher { dispatch(event: object): void; subscribe(event: string, callback: (event: any) => void): void; unsubscribe(event: string, callback: (event: any) => void): void }
let context: RendererContext | undefined;
let replying: string | null = null, editing: string | null = null;
const subscriptions: Array<() => void> = [];
export const settings = Bedrock.definePluginSettings({
    shouldMention: { type: Bedrock.OptionType.SELECT, label: 'Ping reply by default', default: 2,
        options: [{ label: 'Follow No Reply Mention (if enabled)', value: 2 }, { label: 'Enabled', value: 1 }, { label: 'Disabled', value: 0 }] },
    ignoreBlockedAndIgnored: { type: Bedrock.OptionType.BOOLEAN, label: 'Skip blocked and ignored users', description: 'Ignore their messages when navigating.', default: true }
});
function find<T>(predicate: (value: any) => boolean): T | undefined { return context?.webpack.find<T>(predicate); }
function currentUser(): string | undefined { return find<{ getCurrentUser(): { id: string } }>(v => typeof v?.getCurrentUser === 'function')?.getCurrentUser()?.id; }
function dispatcher(): Dispatcher | undefined { return find<Dispatcher>(v => typeof v?.dispatch === 'function' && typeof v?.subscribe === 'function'); }
function mention(message: Message): boolean {
    if (settings.store.shouldMention !== 2) return settings.store.shouldMention === 1;
    const plugins = (Bedrock as unknown as { plugins: { list(): Array<{ manifest: { id: string }; enabled: boolean; settings: Record<string, unknown> }> } }).plugins.list();
    const plugin = plugins.find(plugin => plugin.manifest.id === 'gameknight963.no-reply-mention');
    if (!plugin?.enabled) return true;
    const values = plugin.settings as Record<string, unknown>;
    let listed = String(values.userList ?? '').split(/[,\s]+/).includes(message.author.id);
    const guild = find<{ getChannel(id: string): Channel | undefined }>(v => typeof v?.getChannel === 'function' && typeof v?.getDMFromUserId === 'function')?.getChannel(message.channel_id)?.guild_id;
    if (guild && !listed) {
        const member = find<{ getMember(guild: string, user: string): { roles?: string[] } }>(v => typeof v?.getMember === 'function' && typeof v?.getMembers === 'function')?.getMember(guild, message.author.id);
        const roles = String(values.roleList ?? '').split(/[,\s]+/);
        listed = member?.roles?.some(role => roles.includes(role)) ?? false;
    }
    const exempt = values.shouldPingListed ? listed : !listed;
    return exempt;
}
function navigate(up: boolean, edit: boolean): void {
    const channelId = find<{ getChannelId(): string }>(v => typeof v?.getChannelId === 'function' && (v.constructor?.displayName === 'SelectedChannelStore' || typeof v?.getLastSelectedChannelId === 'function'))?.getChannelId();
    if (!channelId) return;
    const channel = find<{ getChannel(id: string): Channel | undefined }>(v => typeof v?.getChannel === 'function' && typeof v?.getDMFromUserId === 'function')?.getChannel(channelId);
    if (!channel) return;
    const permissions = find<{ can(permission: bigint, channel: Channel): boolean }>(v => typeof v?.can === 'function' && typeof v?.getChannelPermissions === 'function');
    if (channel.guild_id && !permissions?.can(2048n, channel)) return;
    const store = find<{ getMessages(id: string): { _array: Message[] } }>(v => typeof v?.getMessages === 'function' && typeof v?.getMessage === 'function');
    const relationships = find<{ isBlockedOrIgnored?(id: string): boolean; isBlocked?(id: string): boolean; isIgnored?(id: string): boolean }>(v => typeof v?.isBlocked === 'function' && typeof v?.getRelationships === 'function');
    const types = find<{ REPLYABLE: Set<number> }>(v => v?.REPLYABLE instanceof Set)?.REPLYABLE;
    const messages = (store?.getMessages(channelId)?._array ?? []).filter(message => !message.deleted &&
        (!edit || message.author.id === currentUser()) && (types ? types.has(message.type) : [0, 19, 20, 23].includes(message.type)) &&
        !(message.hasFlag?.(64) ?? ((message.flags ?? 0) & 64)) && (!settings.store.ignoreBlockedAndIgnored ||
            !(relationships?.isBlockedOrIgnored?.(message.author.id) ?? (relationships?.isBlocked?.(message.author.id) || relationships?.isIgnored?.(message.author.id)))));
    const previous = edit ? editing : replying;
    const index = messages.findIndex(message => message.id === previous);
    const message = previous === null || index < 0 ? messages.at(-1) : messages[index + (up ? -1 : 1)];
    if (edit) editing = message?.id ?? null; else replying = message?.id ?? null;
    const flux = dispatcher();
    if (!message) { flux?.dispatch({ type: edit ? 'MESSAGE_END_EDIT' : 'DELETE_PENDING_REPLY', channelId }); return; }
    if (edit) flux?.dispatch({ type: 'MESSAGE_START_EDIT', channelId, messageId: message.id, content: message.content, _isQuickEdit: true });
    else {
        flux?.dispatch({ type: 'CREATE_PENDING_REPLY', channel, message, shouldMention: mention(message), showMentionToggle: !(channel.isPrivate?.() ?? !channel.guild_id) && message.author.id !== currentUser(), _isQuickReply: true });
        find<{ dispatchToLastSubscribed(type: string): void }>(v => typeof v?.dispatchToLastSubscribed === 'function')?.dispatchToLastSubscribed('TEXTAREA_FOCUS');
    }
    const rect = document.getElementById(`message-content-${message.id}`)?.getBoundingClientRect();
    if (rect && (rect.bottom < 150 || rect.top >= Math.max(document.documentElement.clientHeight, innerHeight) - 150))
        find<{ jumpToMessage(options: object): void }>(v => typeof v?.jumpToMessage === 'function' && typeof v?.sendMessage === 'function')?.jumpToMessage({ channelId, messageId: message.id, flash: false, jumpType: 'INSTANT' });
}
function keydown(event: KeyboardEvent): void {
    if (!context || context.signal.aborted || !event.ctrlKey || event.altKey || event.metaKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    try { navigate(event.key === 'ArrowUp', event.shiftKey); } catch (error) { context.log.error('Could not select the next message.', error); }
}
export async function start(ctx: RendererContext): Promise<void> {
    context = ctx; replying = editing = null;
    const flux = await ctx.webpack.waitFor<Dispatcher>(v => typeof v?.dispatch === 'function' && typeof v?.subscribe === 'function');
    if (ctx.signal.aborted) return;
    const handlers: Record<string, (event: any) => void> = {
        DELETE_PENDING_REPLY: () => { replying = null; }, MESSAGE_END_EDIT: () => { editing = null; },
        CHANNEL_SELECT: () => { replying = editing = null; },
        CREATE_PENDING_REPLY: event => { if (!event._isQuickReply) replying = event.message?.id ?? null; },
        MESSAGE_START_EDIT: event => { if (!event._isQuickEdit) editing = event.messageId ?? null; }
    };
    for (const [name, handler] of Object.entries(handlers)) { flux.subscribe(name, handler); subscriptions.push(() => flux.unsubscribe(name, handler)); }
    document.addEventListener('keydown', keydown);
}
export function stop(): void {
    document.removeEventListener('keydown', keydown);
    for (const unsubscribe of subscriptions.splice(0)) unsubscribe();
    replying = editing = null; context = undefined;
}
