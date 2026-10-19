/* Copyright (c) 2022-2026 Vendicated and Bedrock contributors. SPDX-License-Identifier: GPL-3.0-or-later */
import type { ReactRuntime, RendererContext } from '@bedrock/renderer';
export interface Message { id: string; channel_id: string; content: string; author: any; attachments: any[]; embeds: any[]; components: any[]; [key: string]: any }
export interface Channel { id: string; guild_id: string; recipients: string[]; isDM(): boolean; isGroupDM(): boolean; isPrivate(): boolean; [key: string]: any }
export interface Attachment { width: number; height: number; url: string; proxyURL?: string }
let context: RendererContext;
export function setContext(ctx: RendererContext): void { context = ctx; }
function find(predicate: (value: any) => boolean, name: string): any {
    const value = context.webpack.find(predicate);
    if (!value) throw new Error(`Discord's ${name} is not available.`);
    return value;
}
function lazy(factory: () => any): any {
    return new Proxy(function () {}, {
        get(_target, key) { const value = factory(), property = value[key]; return typeof property === 'function' ? property.bind(value) : property; },
        apply(_target, receiver, args) { return Reflect.apply(factory(), receiver, args); }
    });
}
function byCode(name: string, ...parts: string[]): any {
    return find(value => {
        const fn = value?.type || value?.render || value;
        return typeof fn === 'function' && parts.every(part => String(fn).includes(part));
    }, name);
}
export const React: ReactRuntime = new Proxy({} as ReactRuntime, { get(_target, key: keyof ReactRuntime) {
    if (key === 'Fragment') return context.react.Fragment;
    return (...args: unknown[]) => Reflect.apply(context.react[key] as Function, context.react, args);
} });
const store = (name: string): any => lazy(() => find(value => value?.getName?.() === name, name));
export const ChannelStore = store('ChannelStore'), GuildStore = store('GuildStore'), MessageStore = store('MessageStore'), UserStore = store('UserStore');
export const PermissionStore = store('PermissionStore');
export const PermissionsBits = lazy(() => find(value => typeof value?.VIEW_CHANNEL === 'bigint' && typeof value?.SEND_MESSAGES === 'bigint', 'permissions'));
export const IconUtils = lazy(() => find(value => value?.getUserAvatarURL && value?.getGuildIconURL && value?.getChannelIconURL, 'avatar URLs'));
export const Parser = lazy(() => find(value => value?.parse && value?.parseTopic, 'message parser'));
export function Embed(props: any): any {
    return React.createElement(find(value => typeof value === 'function' && value.prototype?.renderSuppressButton, 'rich embed'), props);
}
export function ChannelMessage(props: any): any { return React.createElement(byCode('channel message', 'childrenExecutedCommand:', '.hideAccessories'), props); }
export function BaseText({ size = 'xs', weight = 'medium', tag = 'span', color, className, children }: any): any {
    return React.createElement(tag, { className, style: { fontSize: size === 'xs' ? '12px' : '14px', lineHeight: 1.33333,
        fontWeight: weight === 'medium' ? 500 : 400, color: color ? `var(--${color})` : 'var(--text-default)', fontFamily: 'var(--font-primary)' } }, children);
}
export const EmbedClasses = lazy(() => find(value => ['embedAuthorIcon', 'embedAuthor', 'embedMargin'].every(key => typeof value?.[key] === 'string'), 'embed styles'));
export const MessageDisplayCompact = { useSetting(): boolean {
    const settings = find(value => value?.getName?.() === 'UserSettingsProtoStore', 'user settings');
    const [, refresh] = React.useState(0);
    React.useEffect(() => {
        const update = () => refresh(value => value + 1);
        settings.addChangeListener(update);
        return () => settings.removeChangeListener(update);
    }, [settings]);
    return settings.settings.textAndImages?.messageDisplayCompact?.value ?? false;
} };
export function updateMessage(channelId: string, messageId: string): void {
    if (!context || context.signal.aborted) return;
    const cache = find(value => value?.getOrCreate && value?.commit && value?._channelMessages, 'message cache');
    const messages = cache.getOrCreate(channelId);
    if (!messages.has(messageId)) return;
    cache.commit(messages.update(messageId, (old: any) => new old.constructor(old)));
    MessageStore.emitChange();
}
export async function requestMessage(channelId: string, messageId: string): Promise<any> {
    return find(value => value?.get && value?.del && value?.put, 'HTTP client').get({
        url: `/channels/${channelId}/messages`, query: { limit: 1, around: messageId }, retries: 2
    });
}
