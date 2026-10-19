/* Copyright (c) 2025 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { BeforeSendEvent, Disposer, RendererContext, SourcePatch } from '@bedrock/renderer';
import { splitMessage } from './splitMessage.js';

let context: RendererContext, dispose: Disposer | undefined;
interface Batch { channelId: string; chunks: string[]; sent: number; restored: boolean }
const batches = new Map<string, Batch>();
export const settings = Bedrock.definePluginSettings({
    sendDelay: { type: Bedrock.OptionType.SLIDER, label: 'Send delay', description: 'Minimum delay between message parts, in seconds.', default: 1, min: 0.5, max: 10, step: 0.5 },
    splitMode: { type: Bedrock.OptionType.SELECT, label: 'Split at', description: 'Preferred boundary between message parts.', default: 'newlines', options: [
        { label: 'Newlines', value: 'newlines' }, { label: 'Spaces', value: 'spaces' }, { label: 'Strict character limit', value: 'characters' }
    ] },
    splitInSlowmode: { type: Bedrock.OptionType.BOOLEAN, label: 'Split in slowmode', description: 'Allow splitting when the channel slowmode is within the configured maximum.', default: false },
    slowmodeMax: { type: Bedrock.OptionType.SLIDER, label: 'Maximum slowmode', description: 'Maximum channel slowmode allowed when splitting, in seconds.', default: 5, min: 1, max: 30, step: 1 }
});
export const patches: SourcePatch[] = [
    { id: 'message-length', find: 'type:"MESSAGE_LENGTH_UPSELL"', replacement: { match: /if\([A-Za-z_$][\w$]*\.length>[A-Za-z_$][\w$]*/, replace: 'if(false' } },
    { id: 'prevent-text-file-conversion', find: '.onHideAutocomplete?', replacement: { match: /(?<=getData\([A-Za-z_$][\w$]*\.type\);)if\([A-Za-z_$][\w$]*\.length>[A-Za-z_$][\w$]*\)/, replace: 'if(false)' } }
];
function find<T = any>(predicate: (value: any) => boolean, name: string): T {
    const result = context.webpack.find<T>(predicate);
    if (!result) throw new Error(`Discord's ${name} is not available.`);
    return result;
}
function input(): { dispatchToLastSubscribed(name: string, value?: unknown): void } {
    return find(value => typeof value?.dispatchToLastSubscribed === 'function', 'chat input dispatcher');
}
function restore(batch: Batch): void {
    if (batch.restored || batch.sent === batch.chunks.length) return;
    batch.restored = true;
    const activation = context;
    const content = batch.chunks.slice(batch.sent).join('');
    try {
        const selected = find(value => typeof value?.getChannelId === 'function' && value.getName?.() === 'SelectedChannelStore', 'selected channel');
        if (selected.getChannelId() === batch.channelId) input().dispatchToLastSubscribed('INSERT_TEXT', { rawText: content, plainText: content });
        else void navigator.clipboard.writeText(content).then(() => {
            if (activation === context && !activation.signal.aborted) activation.notifications.show({ title: 'Unsent message parts copied to clipboard.' });
        }).catch(error => context.log.error('Could not copy unsent message parts:', error));
    } catch (error) { context.log.error('Could not restore unsent message parts:', error); batch.restored = false; }
}
function sleep(delay: number, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(signal.reason); };
        const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, delay);
        signal.addEventListener('abort', abort, { once: true });
    });
}
export async function beforeSend(event: BeforeSendEvent): Promise<void> {
    const activation = context;
    const user = find(value => typeof value?.getCurrentUser === 'function' && typeof value?.getUser === 'function', 'user store').getCurrentUser();
    const limit = user?.premiumType === 2 ? 4000 : 2000;
    if (event.message.content.length <= limit) return;
    event.cancel();
    if (batches.has(event.channelId)) { context.notifications.show({ title: 'A split message is still sending in this channel.', type: 'error' }); return; }
    const channel = find(value => typeof value?.getChannel === 'function' && typeof value?.getDMFromUserId === 'function', 'channel store').getChannel(event.channelId);
    let bypass = false;
    if (channel?.rateLimitPerUser) {
        const permissions = find(value => typeof value?.can === 'function' && typeof value?.getGuildPermissions === 'function', 'permissions');
        const bits = find(value => typeof value?.MANAGE_MESSAGES === 'bigint' && typeof value?.MANAGE_CHANNELS === 'bigint', 'permission flags');
        bypass = permissions.can(bits.MANAGE_MESSAGES, channel) || permissions.can(bits.MANAGE_CHANNELS, channel);
    }
    if (!channel) { context.notifications.show({ title: `Could not find channel ${event.channelId} to split this message.`, type: 'error' }); return; }
    if (channel.rateLimitPerUser && !bypass && (!settings.store.splitInSlowmode || channel.rateLimitPerUser > settings.store.slowmodeMax)) {
        context.notifications.show({ title: settings.store.splitInSlowmode ? `This channel has ${channel.rateLimitPerUser}s slowmode; the configured maximum is ${settings.store.slowmodeMax}s.` : 'Splitting messages in slowmode channels is disabled.', type: 'error' }); return;
    }
    const mode = settings.store.splitMode;
    const chunks = splitMessage(event.message.content, limit, mode === 'characters' || mode === 'spaces' ? mode : 'newlines');
    const batch: Batch = { channelId: event.channelId, chunks, sent: 0, restored: false };
    const delay = Math.max(settings.store.sendDelay * 1000, !bypass && channel.rateLimitPerUser ? channel.rateLimitPerUser * 1000 + 250 : 0);
    input().dispatchToLastSubscribed('CLEAR_TEXT');
    batches.set(event.channelId, batch);
    try {
        for (const chunk of chunks) {
            activation.signal.throwIfAborted();
            if (activation !== context) break;
            await activation.messages.send(event.channelId, { content: chunk });
            batch.sent++;
            if (batch.sent < chunks.length) await sleep(delay, activation.signal);
        }
    } catch (error) { if (!activation.signal.aborted) activation.log.error(`Failed after sending ${batch.sent}/${chunks.length} message parts:`, error); }
    finally {
        if (batch.sent !== chunks.length && activation === context) {
            restore(batch);
            if (!activation.signal.aborted) activation.notifications.show({ title: `Only ${batch.sent}/${chunks.length} message parts were sent.`, type: 'error' });
        }
        if (batches.get(event.channelId) === batch) batches.delete(event.channelId);
    }
}
export function start(ctx: RendererContext): void { context = ctx; dispose = ctx.messages.beforeSend(beforeSend); }
export function stop(): void {
    dispose?.(); dispose = undefined;
    for (const batch of batches.values()) restore(batch);
    batches.clear();
}
