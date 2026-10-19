/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { RendererContext, RendererSettingsContext, SettingDefinition } from '@bedrock/renderer';
let context: RendererContext | undefined;
let uiContext: RendererSettingsContext | undefined;
export function setContext(value?: RendererContext): void { context = value; }
export function setUiContext(value: RendererSettingsContext): void { uiContext = value; }
export function getContext(): RendererContext | undefined { return context; }
export function getUiContext(): RendererSettingsContext { const value = uiContext ?? context; if (!value) throw new Error('The settings editor is closed.'); return value; }
export function isActive(): boolean { return !!context && !context.signal.aborted; }
function find<T = any>(predicate: (value: any) => boolean): T {
    const value = context?.webpack.find<T>(predicate);
    if (!value) throw new Error('A Discord module needed for this action is not available.');
    return value;
}
function proxy(predicate: (value: any) => boolean): any {
    return new Proxy({}, { get(_target, property) { const object = find<any>(predicate); const value = object[property]; return typeof value === 'function' ? value.bind(object) : value; } });
}
export const AuthenticationStore = { getId: () => find(v => typeof v?.getCurrentUser === 'function').getCurrentUser()?.id };
export const EditMessageStore = proxy(v => typeof v?.isEditing === 'function');
export const FluxDispatcher = proxy(v => typeof v?.dispatch === 'function' && typeof v?.subscribe === 'function');
export const MessageActions = proxy(v => typeof v?.sendMessage === 'function' && typeof v?.deleteMessage === 'function');
export const MessageTypeSets = proxy(v => v?.REPLYABLE instanceof Set);
export const PermissionsBits = { SEND_MESSAGES: 2048n, MANAGE_MESSAGES: 8192n, ADD_REACTIONS: 64n, READ_MESSAGE_HISTORY: 65536n };
export const PermissionStore = proxy(v => typeof v?.can === 'function' && typeof v?.getChannelPermissions === 'function');
export const PinActions = proxy(v => typeof v?.pinMessage === 'function' && typeof v?.unpinMessage === 'function');
export const RestAPI = proxy(v => typeof v?.get === 'function' && typeof v?.put === 'function' && typeof v?.del === 'function' && typeof v?.post === 'function');
export const Constants = { Endpoints: { REACTION: (channel: string, message: string, emoji: string, user: string) => `/channels/${channel}/messages/${message}/reactions/${encodeURIComponent(emoji)}/${user}` } };
export const WindowStore = { isFocused: () => document.hasFocus(), addChangeListener: (callback: () => void) => window.addEventListener('blur', callback), removeChangeListener: (callback: () => void) => window.removeEventListener('blur', callback) };
export function showToast(title: string, type?: string, options?: { duration: number }): void { context?.notifications.show({ title, type: type === 'failure' ? 'error' : 'success', timeout: options?.duration }); }
export function copyWithToast(text: string, title: string): void {
    const activation = context;
    void navigator.clipboard.writeText(text).then(() => { if (activation && !activation.signal.aborted) activation.notifications.show({ title, type: 'success' }); }).catch(error => activation?.log.error('Could not copy to the clipboard.', error));
}
export function insertTextIntoChatInputBox(content: string): void { find(v => typeof v?.dispatchToLastSubscribed === 'function').dispatchToLastSubscribed('INSERT_TEXT', { plainText: content }); }
export function openExternal(url: string): void {
    const activation = context;
    if (!activation || activation.signal.aborted) return;
    void activation.events.emit('message-click-actions.open-external', url).catch(error => activation.log.error('Could not open the message in your browser.', error));
}
function replyPlugin(): { enabled: boolean; settings: Record<string, any> } | undefined {
    return (Bedrock as unknown as { plugins: { list(): Array<{ manifest: { id: string }; enabled: boolean; settings: Record<string, any> }> } }).plugins.list().find(plugin => plugin.manifest.id === 'gameknight963.no-reply-mention');
}
export function isNoReplyMentionEnabled(): boolean { return replyPlugin()?.enabled ?? false; }
export function replyMention(message: any, shift: boolean): boolean {
    const values = replyPlugin()?.settings ?? {};
    let listed = String(values.userList ?? '').split(/[,\s]+/).includes(message.author.id);
    const channel = find(v => typeof v?.getChannel === 'function' && typeof v?.getDMFromUserId === 'function').getChannel(message.channel_id);
    if (channel?.guild_id && !listed) {
        const roles = String(values.roleList ?? '').split(/[,\s]+/);
        listed = find(v => typeof v?.getMember === 'function' && typeof v?.getMembers === 'function').getMember(channel.guild_id, message.author.id)?.roles?.some((role: string) => roles.includes(role)) ?? false;
    }
    const exempt = values.shouldPingListed ? listed : !listed;
    return values.inverseShiftReply ? shift !== exempt : !shift && exempt;
}
export const OptionType = { ...Bedrock.OptionType, COMPONENT: 'component' };
export function makeRange(min: number, max: number, step: number): number[] { const values: number[] = []; for (let value = min; value <= max; value += step) values.push(value); return values; }
const labels: Record<string, string> = {
    singleClickAction: 'Single click: your messages', singleClickModifier: 'Single-click modifier: your messages',
    singleClickOthersAction: 'Single click: other messages', singleClickOthersModifier: 'Single-click modifier: other messages',
    doubleClickAction: 'Double click: your messages', doubleClickOthersAction: 'Double click: other messages',
    doubleClickModifier: 'Double-click modifier', tripleClickAction: 'Triple-click action', tripleClickModifier: 'Triple-click modifier',
    addAdditionalReacts: 'Add additional reactions', disableInDms: 'Disable in DMs', disableInSystemDms: 'Disable in system DMs',
    clickTimeout: 'Click interval', doubleClickHoldThreshold: 'Double-click hold limit', deferDoubleClickForTriple: 'Enable triple clicks',
    selectionHoldTimeout: 'Text selection hold time', quoteWithReply: 'Reply when quoting', useSelectionForQuote: 'Quote selected text'
};
export function definePluginSettings(definitions: Record<string, any>): any {
    const standard: Record<string, SettingDefinition> = {};
    for (const [key, definition] of Object.entries(definitions)) {
        if (definition.type === 'component') continue;
        standard[key] = { type: definition.type, label: labels[key] ?? key, description: definition.description, default: definition.default, options: definition.options };
        if (definition.markers) Object.assign(standard[key], { min: definition.markers[0], max: definition.markers.at(-1), step: definition.markers[1] - definition.markers[0] });
    }
    const publicSettings = Bedrock.definePluginSettings(standard);
    return { publicSettings, store: new Proxy({}, { get(_target, key: string) {
        if (key in standard) return publicSettings.store[key];
        return (context ?? uiContext)?.settings.get(key, definitions[key]?.default) ?? definitions[key]?.default;
    } }), use: publicSettings.use.bind(publicSettings) };
}
export function definePlugin<T>(plugin: T): T { return plugin; }
