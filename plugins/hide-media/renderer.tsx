/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
let context: RendererContext | undefined;
let hiddenMessages = new Set<string>();
let queue: Promise<void> = Promise.resolve();
const observed = new Map<string, string>();
let refreshMessage: ((channelId: string, messageId: string) => void) | undefined;
const React = { createElement(type: any, props: any, ...children: any[]): any { return context?.react.createElement(type, props, ...children); } };
declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } } }
interface Message { id: string; channel_id: string; content?: string; attachments?: unknown[]; embeds?: unknown[]; stickerItems?: unknown[]; components?: unknown[]; messageSnapshots?: Array<{ message: Message }> }
export function ImageVisible(props: any): any {
    return <svg width="24" height="24" {...props} viewBox="0 0 24 24"><path fill="currentColor" d="M5 21q-.825 0-1.413-.587Q3 19.825 3 19V5q0-.825.587-1.413Q4.175 3 5 3h14q.825 0 1.413.587Q21 4.175 21 5v14q0 .825-.587 1.413Q19.825 21 19 21Zm0-2h14V5H5v14Zm1-2h12l-3.75-5-3 4L9 13Zm-1 2V5v14Z" /></svg>;
}
export function ImageInvisible(props: any): any {
    return <svg width="24" height="24" {...props} viewBox="0 0 24 24"><path fill="currentColor" d="m21 18.15-2-2V5H7.85l-2-2H19q.825 0 1.413.587Q21 4.175 21 5Zm-1.2 4.45L18.2 21H5q-.825 0-1.413-.587Q3 19.825 3 19V5.8L1.4 4.2l1.4-1.4 18.4 18.4ZM6 17l3-4 2.25 3 .825-1.1L5 7.825V19h11.175l-2-2Zm7.425-6.425ZM10.6 13.4Z" /></svg>;
}
function hasMedia(message: Message): boolean {
    return [message.attachments, message.embeds, message.stickerItems, message.components].some(items => !!items?.length);
}
function remember(message: Message): void {
    if (message.id && message.channel_id) observed.set(message.id, message.channel_id);
}
export function shouldHide(messageId: string): boolean {
    return !!context && !context.signal.aborted && hiddenMessages.has(messageId);
}
export function toggleHide(channelId: string, messageId: string): Promise<void> {
    const activation = context;
    if (!activation || activation.signal.aborted) return Promise.resolve();
    const operation = queue.then(async () => {
        if (context !== activation || activation.signal.aborted) return;
        const updated = new Set(hiddenMessages);
        if (!updated.delete(messageId)) updated.add(messageId);
        await activation.settings.set('hiddenMessageIds', [...updated]);
        if (context !== activation || activation.signal.aborted) return;
        hiddenMessages = updated;
        observed.set(messageId, channelId);
        refreshMessage?.(channelId, messageId);
    });
    queue = operation.catch(error => { activation.log.error(`Could not save hidden media for message ${messageId} in channel ${channelId}.`, error); });
    return queue;
}
const identifier = '(?:[A-Za-z_$][\\w$]*)';
export const patches: SourcePatch[] = [
    { id: 'hide-message-media', find: 'this.renderAttachments(', replacement: {
        match: new RegExp(String.raw`(?<=\i=)this\.render(?:Attachments|Embeds|StickersAccessories|ComponentAccessories)\((\i)\)`.replaceAll('\\i', identifier), 'g'),
        replace: '$self.shouldHide($1?.id)?null:$&'
    } },
    { id: 'message-refresh', find: '}renderStickersAccessories(', replacement: {
        match: new RegExp(String.raw`(?<=this.props,\i,\[)(?:"message",)?`.replaceAll('\\i', identifier)), replace: ''
    } }
];
export function start(ctx: RendererContext): void {
    context = ctx; observed.clear(); queue = Promise.resolve();
    const stored = ctx.settings.get<unknown>('hiddenMessageIds', []);
    hiddenMessages = new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id)) : []);
    const cache: any = ctx.webpack.find((value: any) => value?.getOrCreate && value?.commit && value?._channelMessages);
    const messageStore: any = ctx.webpack.find((value: any) => value?.getMessage && value?.getMessages && value?.emitChange);
    if (!cache || !messageStore) throw new Error('Hide Media could not find Discord\'s message cache and message store.');
    refreshMessage = (channelId, messageId) => {
        const messages = cache.getOrCreate(channelId);
        if (!messages.has(messageId)) return;
        cache.commit(messages.update(messageId, (old: any) => new old.constructor(old)));
        messageStore.emitChange();
    };
    ctx.styles.add('.bedrock-hide-media-accessory{color:var(--text-muted);margin-top:.5em;font-style:italic;font-weight:400}.bedrock-hide-media-no-content{margin-top:0}');
    ctx.messages.addButton('hide-media', ({ message: raw }) => {
        const message = raw as Message; remember(message);
        if (!hasMedia(message) && !message.messageSnapshots?.some(snapshot => hasMedia(snapshot.message))) return null;
        const hidden = shouldHide(message.id);
        return { label: hidden ? 'Show Media' : 'Hide Media', icon: hidden ? ImageVisible : ImageInvisible, onClick: () => toggleHide(message.channel_id, message.id) };
    });
    ctx.messages.addAccessory('hidden-media', ({ message: raw }) => {
        const message = raw as Message; remember(message);
        if (!shouldHide(message.id)) return null;
        return <span className={'bedrock-hide-media-accessory' + (!message.content ? ' bedrock-hide-media-no-content' : '')}>Media Hidden</span>;
    });
}
export function stop(): void {
    context = undefined; hiddenMessages.clear();
    for (const [messageId, channelId] of observed) refreshMessage?.(channelId, messageId);
    observed.clear(); refreshMessage = undefined;
}
