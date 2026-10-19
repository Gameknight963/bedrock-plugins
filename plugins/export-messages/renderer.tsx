/* Copyright (c) 2025 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
let context: RendererContext | undefined;
let contactList: Record<string, string[]> | undefined;
const React = { createElement(type: any, props: any, ...children: any[]): any { return context?.react.createElement(type, props, ...children); } };
declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } } }
interface Contact { type: number; user: { username: string; discriminator: string } }
interface Message { id: string; timestamp: { toString(): string }; author: { username: string; discriminator: string }; content: string; attachments?: Array<{ filename: string; url: string }>; embeds?: Array<{ rawTitle?: string; rawDescription?: string; url?: string }> }
interface NativeFileManager { saveWithDialog(data: Uint8Array, filename: string): Promise<string | undefined>; showItemInFolder(path: string): void }
export const settings = Bedrock.definePluginSettings({
    openFileAfterExport: { type: Bedrock.OptionType.BOOLEAN, label: 'Reveal exported file', description: 'Show the exported file in its folder after saving.', default: true },
    exportContacts: { type: Bedrock.OptionType.BOOLEAN, label: 'Export contacts', description: 'Add an Export button to the Friends tab to copy your contact list.', default: false }
});
export function formatMessage(message: Message): string {
    const timestamp = new Date(message.timestamp.toString()).toLocaleString();
    let content = `[${timestamp}] ${message.author.username}`;
    if (message.author.discriminator && message.author.discriminator !== '0') content += `#${message.author.discriminator}`;
    content += `: ${message.content}`;
    if (message.attachments?.length) {
        content += '\n  Attachments:';
        for (const attachment of message.attachments) content += `\n    - ${attachment.filename} (${attachment.url})`;
    }
    if (message.embeds?.length) {
        content += '\n  Embeds:';
        for (const embed of message.embeds) {
            if (embed.rawTitle) content += `\n    Title: ${embed.rawTitle}`;
            if (embed.rawDescription) content += `\n    Description: ${embed.rawDescription}`;
            if (embed.url) content += `\n    URL: ${embed.url}`;
        }
    }
    return content;
}
export async function exportMessage(message: Message): Promise<void> {
    const ctx = context;
    if (!ctx || ctx.signal.aborted) return;
    try {
        const timestamp = new Date(message.timestamp.toString());
        if (!Number.isFinite(timestamp.valueOf())) throw new Error(`Message ${message.id} has an invalid timestamp: ${String(message.timestamp)}.`);
        const filename = `message-${message.id}-${timestamp.toISOString().split('T')[0]}.txt`;
        const native = (globalThis as unknown as { DiscordNative?: { fileManager?: NativeFileManager } }).DiscordNative?.fileManager;
        if (typeof native?.saveWithDialog !== 'function') throw new Error('DiscordNative.fileManager.saveWithDialog is unavailable.');
        const result = await native.saveWithDialog(new TextEncoder().encode(formatMessage(message)), filename);
        if (ctx !== context || ctx.signal.aborted || !result) return;
        if (typeof result !== 'string') throw new Error(`Discord\'s save dialog returned an invalid file path: ${JSON.stringify(result)}.`);
        if (settings.store.openFileAfterExport) {
            if (typeof native.showItemInFolder !== 'function') throw new Error('The message was saved, but DiscordNative.fileManager.showItemInFolder is unavailable.');
            native.showItemInFolder(result);
        }
        ctx.notifications.show({ title: 'Export Messages', body: `Message exported as ${filename}`, type: 'success' });
    } catch (error) {
        if (ctx !== context || ctx.signal.aborted) return;
        ctx.log.error(`Could not export message ${message.id}.`, error);
        ctx.notifications.show({ title: 'Could not export message', body: error instanceof Error ? error.message : String(error), type: 'error' });
    }
}
function Icon(): any {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" /></svg>;
}
export function getContacts(contacts: Contact[]): void {
    if (!context || context.signal.aborted || !Array.isArray(contacts)) return;
    const names = (type: number): string[] => contacts.filter(contact => contact.type === type && typeof contact.user?.username === 'string').map(contact => contact.user.discriminator && contact.user.discriminator !== '0' ? `${contact.user.username}#${contact.user.discriminator}` : contact.user.username);
    contactList = { friendsAdded: names(1), blockedUsers: names(2), incomingFriendRequests: names(3), outgoingFriendRequests: names(4) };
}
export async function copyContacts(): Promise<void> {
    const ctx = context;
    if (!ctx || ctx.signal.aborted) return;
    if (!contactList) {
        ctx.notifications.show({ title: 'Open the All tab before exporting contacts', type: 'error' });
        return;
    }
    try {
        await navigator.clipboard.writeText(JSON.stringify(contactList));
        if (ctx === context && !ctx.signal.aborted) ctx.notifications.show({ title: 'Contacts copied to clipboard', type: 'success' });
    } catch (error) {
        if (ctx === context && !ctx.signal.aborted) ctx.notifications.show({ title: 'Could not copy contacts', body: error instanceof Error ? error.message : String(error), type: 'error' });
    }
}
function ExportButton(): any {
    settings.use(['exportContacts']);
    if (!settings.store.exportContacts || !context || context.signal.aborted) return null;
    return <button className="export-contacts-button" onClick={() => { void copyContacts(); }}>Export</button>;
}
export function addExportButton(): any { return context && !context.signal.aborted ? <ExportButton key="export-contacts" /> : null; }
const identifier = '(?:[A-Za-z_$][\\w$]*)';
export const patches: SourcePatch[] = [
    { id: 'capture-contact-list', find: 'fetchRelationships(){', replacement: {
        match: new RegExp(String.raw`(\.then\(\i)=>(\i\.\i\.dispatch\({type:"LOAD_RELATIONSHIPS_SUCCESS",relationships:(\i\.body)}\))`.replaceAll('\\i', identifier)),
        replace: '$1=>{$2;$self.getContacts($3)}'
    } },
    { id: 'friends-export-button', find: '.getLastFocusableElement()}', replacement: {
        match: new RegExp(String.raw`("aria-label":(\i).{0,25}children:null!=\i)\?(this\.renderChildren\(\i\)):null`.replaceAll('\\i', identifier)),
        replace: '$1?($2==="Friends"?[...$3,$self.addExportButton()]:$3):null'
    } }
];
export function start(ctx: RendererContext): void {
    context = ctx; contactList = undefined;
    ctx.styles.add('.export-contacts-button{display:flex;justify-content:center;align-items:center;text-align:center;min-width:40px;-webkit-app-region:no-drag;border-radius:4px;margin:0 8px;padding:2px 8px;position:relative;font-size:16px;line-height:20px;cursor:pointer;font-weight:500;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;flex-shrink:0;outline:0;background-color:#5865f2;color:var(--status-positive-text)}.export-contacts-button:hover{background-color:#454fbf}');
    ctx.contextMenus.patch<{ message?: Message }>('message', (children, props) => {
        if (!props.message) return;
        children.push(ctx.contextMenus.item({ id: 'export-message', label: 'Export Message', icon: Icon, leadingAccessory: { type: 'icon', icon: Icon }, action: () => { void exportMessage(props.message!); } }));
    });
}
export function stop(): void { context = undefined; contactList = undefined; }
