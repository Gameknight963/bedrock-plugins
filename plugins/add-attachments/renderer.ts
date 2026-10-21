/* Copyright (c) 2025 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later */
import type { MenuElement, RendererContext } from '@bedrock/renderer';

interface Message {
    id: string;
    channel_id: string;
    author: { id: string };
    type: number;
    flags: number;
    attachments: Array<{ id: string; [key: string]: unknown }>;
}
interface Channel { id: string; isPrivate(): boolean }
interface Rest {
    post(options: { url: string; body: unknown }): Promise<{ body: { attachments: Array<{ id: string; upload_url: string; upload_filename: string }> } }>;
    patch(options: { url: string; body: unknown }): Promise<unknown>;
}
let context: RendererContext;
const inputs = new Set<HTMLInputElement>();
const uploads = new Set<string>();

function find<T>(predicate: (value: any) => boolean, description: string): T {
    const value = context.webpack.find<T>(predicate);
    if (!value) throw new Error(`Discord's ${description} is unavailable.`);
    return value;
}
function store<T>(name: string): T { return find(value => value?.getName?.() === name, name); }
function messageFor(channelId: string, messageId: string): Message | undefined {
    return store<{ getMessage(channelId: string, messageId: string): Message | undefined }>('MessageStore').getMessage(channelId, messageId);
}
export function canAddAttachments(message: Message | undefined): boolean {
    if (!message || context.signal.aborted || ![0, 19].includes(message.type) || (message.flags & 8192) !== 0 || message.attachments.length >= 10) return false;
    const userId = store<{ getId(): string }>('AuthenticationStore').getId();
    if (message.author.id !== userId) return false;
    const channel = store<{ getChannel(id: string): Channel | undefined }>('ChannelStore').getChannel(message.channel_id);
    if (!channel) return false;
    if (channel.isPrivate()) return true;
    const permissions = find<{ can(permission: bigint, channel: Channel): boolean }>(value => typeof value?.can === 'function' && typeof value?.getGuildPermissions === 'function', 'permission store');
    return permissions.can(2048n, channel);
}
function report(error: unknown, ctx: RendererContext): void {
    if (ctx.signal.aborted) return;
    ctx.log.error(error);
    ctx.notifications.show({ title: 'Could not add attachments', body: error instanceof Error ? error.message : String(error), type: 'error' });
}
function UploadIcon({ width = 24, height = 24 }: { width?: number; height?: number } = {}): MenuElement {
    return context.react.createElement('svg', { width, height, viewBox: '0 0 24 24', 'aria-hidden': true },
        context.react.createElement('path', { fill: 'currentColor', d: 'M12 23a11 11 0 1 0 0-22 11 11 0 0 0 0 22Zm0-17a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H7a1 1 0 1 1 0-2h4V7a1 1 0 0 1 1-1Z' }));
}

export async function addAttachments(channelId: string, messageId: string, files: ArrayLike<File>): Promise<void> {
    const ctx = context;
    const selected = Array.from(files);
    if (!selected.length || ctx.signal.aborted) return;
    const key = `${channelId}:${messageId}`;
    if (uploads.has(key)) throw new Error('An attachment upload for this message is already in progress.');
    const message = messageFor(channelId, messageId);
    if (!canAddAttachments(message)) throw new Error('This message cannot accept more attachments. It must be your own regular message or reply, with fewer than ten attachments.');
    const available = 10 - message!.attachments.length;
    if (selected.length > available) throw new Error(`You selected ${selected.length} files, but this message only has room for ${available} more attachment${available === 1 ? '' : 's'}.`);
    uploads.add(key);
    const progress = ctx.notifications.show({ title: 'Uploading attachments', body: selected.map(file => file.name).join(', '), timeout: 0 });
    try {
        const rest = find<Rest>(value => typeof value?.post === 'function' && typeof value?.patch === 'function' && typeof value?.del === 'function', 'message API');
        const { uniqueId } = find<{ uniqueId(): string }>(value => typeof value?.uniqueId === 'function', 'upload ID generator');
        const ids = selected.map(() => uniqueId());
        const response = await rest.post({ url: `/channels/${channelId}/attachments`, body: { files: selected.map((file, index) => ({ filename: file.name, file_size: file.size, id: ids[index], is_clip: false })) } });
        if (ctx.signal.aborted) return;
        const slots = response.body?.attachments;
        if (!Array.isArray(slots) || slots.length !== selected.length) throw new Error(`Discord returned ${Array.isArray(slots) ? slots.length : 'no'} upload slots for ${selected.length} selected files.`);
        const descriptors = slots.map((slot, index) => {
            const position = ids.indexOf(slot.id);
            if (position === -1) throw new Error(`Upload slot ${index + 1} has an unknown file ID: ${JSON.stringify(slot.id)}.`);
            if (typeof slot.upload_filename !== 'string' || !slot.upload_filename) throw new Error(`Upload slot for ${JSON.stringify(selected[position].name)} has an invalid upload_filename: ${JSON.stringify(slot.upload_filename)}.`);
            let url: URL;
            try { url = new URL(slot.upload_url); }
            catch { throw new Error(`Upload slot for ${JSON.stringify(selected[position].name)} has an invalid upload_url: ${JSON.stringify(slot.upload_url)}.`); }
            if (url.protocol !== 'https:') throw new Error(`Upload URL for ${JSON.stringify(selected[position].name)} uses invalid protocol ${JSON.stringify(url.protocol)}. Expected HTTPS.`);
            return { file: selected[position], slot, url };
        });
        if (new Set(slots.map(slot => slot.id)).size !== selected.length) throw new Error('Discord returned duplicate file IDs in its upload slots.');
        const added = await Promise.all(descriptors.map(async ({ file, slot, url }) => {
            let result: Response;
            try { result = await fetch(url, { method: 'PUT', body: file, signal: ctx.signal }); }
            catch (error) { throw new Error(`Could not upload ${JSON.stringify(file.name)}: ${error instanceof Error ? error.message : String(error)}`, { cause: error }); }
            if (!result.ok) throw new Error(`Could not upload ${JSON.stringify(file.name)}: HTTP ${result.status} ${result.statusText}.`);
            return { id: slot.id, uploaded_filename: slot.upload_filename, filename: file.name };
        }));
        if (ctx.signal.aborted) return;
        const latest = messageFor(channelId, messageId);
        if (!latest) throw new Error('The message was deleted before the attachments finished uploading.');
        if (latest.attachments.length + added.length > 10) throw new Error(`The message now has ${latest.attachments.length} attachments; adding ${added.length} would exceed the limit of ten.`);
        await rest.patch({ url: `/channels/${channelId}/messages/${messageId}`, body: { attachments: [...latest.attachments, ...added] } });
        if (!ctx.signal.aborted) ctx.notifications.show({ title: `${selected.length === 1 ? 'Attachment' : 'Attachments'} added`, type: 'success' });
    } finally { uploads.delete(key); progress.close(); }
}

function chooseAttachments(message: Message): void {
    const ctx = context;
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '*/*'; input.multiple = true;
    inputs.add(input);
    const remove = () => { input.remove(); inputs.delete(input); };
    input.addEventListener('cancel', remove, { once: true });
    input.addEventListener('change', () => {
        const files = Array.from(input.files ?? []);
        remove();
        void addAttachments(message.channel_id, message.id, files).catch(error => report(error, ctx));
    }, { once: true });
    input.click();
}
function handlePaste(event: ClipboardEvent): void {
    if (!event.clipboardData?.files.length || context.signal.aborted) return;
    const ctx = context;
    const channelId = store<{ getChannelId(): string }>('SelectedChannelStore').getChannelId();
    const editing = store<{ getEditingMessage(channelId: string): Message | undefined }>('EditMessageStore').getEditingMessage(channelId);
    if (!canAddAttachments(editing)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    void addAttachments(channelId, editing!.id, event.clipboardData.files).catch(error => report(error, ctx));
}
export function start(ctx: RendererContext): void {
    context = ctx;
    document.addEventListener('paste', handlePaste, { capture: true });
    ctx.messages.addButton('add-attachments', ({ message }) => {
        const item = message as unknown as Message;
        return canAddAttachments(item) ? { label: 'Add Attachments', icon: UploadIcon, onClick: () => chooseAttachments(item) } : null;
    });
    ctx.chatBar.addButton('add-attachments', props => {
        if (props.type?.analyticsName !== 'edit') return null;
        const editing = store<{ getEditingMessage(id: string): Message | undefined }>('EditMessageStore').getEditingMessage(props.channel.id);
        return canAddAttachments(editing) ? ctx.chatBar.button({ label: 'Add Attachments', icon: ctx.react.createElement(UploadIcon, { width: 18, height: 18 }), onClick: () => chooseAttachments(editing!) }) : null;
    });
}
export function stop(): void {
    document.removeEventListener('paste', handlePaste, { capture: true });
    for (const input of inputs) input.remove();
    inputs.clear();
}
