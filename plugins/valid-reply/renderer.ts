/* Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
interface ReplyStore { set(channel: string, message: string, value: object): void }
interface Reply { baseMessage?: { messageReference?: { channel_id?: string; message_id?: string } }; referencedMessage?: { state: number } }
let context: RendererContext | undefined;
let replyStore: ReplyStore | undefined;
const fetching = new Map<string, Promise<void>>();
export const patches: SourcePatch[] = [
    { id: 'fetch-unloaded-reply', find: '["1i+hMi"]', replacement: {
        match: /\["1i\+hMi"\]\)/, replace: '$&,onMouseEnter:()=>$self.fetchReply(arguments[0])'
    } },
    { id: 'capture-referenced-message-cache', find: 'ReferencedMessageStore', replacement: {
        match: /_channelCaches=new Map;/, replace: '$&_=$self.setReplyStore(this);'
    } }
];
export function setReplyStore(store: ReplyStore): void { replyStore = store; }
export async function fetchReply(reply: Reply): Promise<void> {
    const activation = context, cache = replyStore;
    const reference = reply.baseMessage?.messageReference;
    const channelId = reference?.channel_id, messageId = reference?.message_id;
    if (!activation || activation.signal.aborted || !cache || !channelId || !messageId || reply.referencedMessage?.state === 0) return;
    const key = `${channelId}/${messageId}`;
    if (fetching.has(key)) return fetching.get(key);
    const task = (async () => {
        try {
            const rest = activation.webpack.find<{ get(options: object): Promise<{ body?: Array<{ id: string; channel_id: string }> }> }>(value => typeof value?.get === 'function' && typeof value?.post === 'function' && typeof value?.put === 'function');
            const flux = activation.webpack.find<{ dispatch(event: object): void }>(value => typeof value?.dispatch === 'function' && typeof value?.subscribe === 'function');
            const create = activation.webpack.find<(raw: object) => unknown>(value => typeof value === 'function' && ['.createFromServer(', '.isBlockedForMessage', 'messageReference:'].every(part => String(value).includes(part)));
            if (!rest || !flux || !create) throw new Error('Discord reply-loading modules are not available.');
            const result = await rest.get({ url: `/channels/${channelId}/messages`, query: { limit: 1, around: messageId }, retries: 2 });
            if (activation.signal.aborted || activation !== context) return;
            const message = result.body?.find(message => message.id === messageId && message.channel_id === channelId);
            if (message) {
                cache.set(channelId, messageId, { state: 0, message: create(message) });
                flux.dispatch({ type: 'MESSAGE_UPDATE', message });
            } else {
                cache.set(channelId, messageId, { state: 2 });
                flux.dispatch({ type: 'MESSAGE_DELETE', channelId, id: messageId });
            }
        } catch (error) { if (!activation.signal.aborted && activation === context) activation.log.warn('Could not load the referenced message.', error); }
    })();
    fetching.set(key, task);
    try { await task; } finally { if (fetching.get(key) === task) fetching.delete(key); }
}
export function start(ctx: RendererContext): void { context = ctx; }
export function stop(): void { context = undefined; fetching.clear(); }
