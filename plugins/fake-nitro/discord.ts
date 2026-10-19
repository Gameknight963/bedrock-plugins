/* Copyright (c) 2026 Bedrock contributors. SPDX-License-Identifier: GPL-3.0-or-later */
import type { BeforeEditEvent, BeforeSendEvent, Disposer, MenuElement, RendererContext, SourcePatch } from '@bedrock/renderer';

let context: RendererContext;
const modals = new Map<string, () => void>();
export function setContext(ctx: RendererContext): void { context = ctx; }
export function activeContext(): RendererContext { return context; }
export function checkActive(activation = context): void {
    if (activation !== context || activation.signal.aborted) throw new DOMException('FakeNitro was disabled.', 'AbortError');
}
function find(predicate: (value: any) => boolean, name: string): any {
    const value = context.webpack.find(predicate);
    if (!value) throw new Error(`Discord's ${name} is not available.`);
    return value;
}
export function proxyLazyWebpack(factory: () => any): any {
    return new Proxy(function () {}, {
        get(_target, key) { const value = factory(); if (!value) throw new Error('A required Discord module is not available.'); const property = value[key]; return typeof property === 'function' ? property.bind(value) : property; },
        apply(_target, receiver, args) { return Reflect.apply(factory(), receiver, args); }
    });
}
export function findByPropsLazy(...props: string[]): any { return proxyLazyWebpack(() => find(value => props.every(prop => value?.[prop] !== undefined), props.join(', '))); }
export function findByCodeLazy(...parts: string[]): any {
    return proxyLazyWebpack(() => find(value => typeof value === 'function' && parts.every(part => Function.prototype.toString.call(value).includes(part)), parts[0]));
}
function store(name: string): any { return proxyLazyWebpack(() => find(value => typeof value?.getName === 'function' && value.getName() === name, name)); }
export const ChannelStore = findByPropsLazy('getChannel', 'getDMFromUserId');
export const EmojiStore = findByPropsLazy('getCustomEmojiById', 'getGuildEmoji');
export const StickersStore = findByPropsLazy('getStickerById');
export const GuildMemberStore = findByPropsLazy('getSelfMember', 'getMember');
export const OverridePremiumTypeStore = store('OverridePremiumTypeStore');
export const UserSettingsProtoStore = store('UserSettingsProtoStore');
export const FluxDispatcher = findByPropsLazy('dispatch', 'subscribe');
export const PermissionStore = findByPropsLazy('can', 'getGuildPermissions');
export const PermissionsBits = findByPropsLazy('ADMINISTRATOR', 'USE_EXTERNAL_EMOJIS');
export const React = proxyLazyWebpack(() => context.react);
export const IconUtils = findByPropsLazy('getGuildBannerURL', 'getUserAvatarURL');
export function expressionUrl(source: unknown, description: string): URL {
    try {
        if (typeof source !== 'string' || !source.trim()) throw new TypeError('Expected a nonempty URL string.');
        const url = source.startsWith('/') ? new URL(source, globalThis.location?.href) : new URL(source);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new TypeError(`Expected HTTP or HTTPS, received ${url.protocol}`);
        return url;
    } catch (cause) {
        const value = typeof source === 'string' ? JSON.stringify(source) : `${String(source)} (${typeof source})`;
        throw new Error(`${description} has an invalid URL: ${value}. ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
    }
}
export const ConfirmModal = findByCodeLazy('actionBarInput:', '"critical"', '"secondary');
export const UploadHandler = { promptToUpload: findByCodeLazy('Unexpected mismatch between files and file metadata') };
export const DraftType = { ChannelMessage: 0 };
export const UserSettingsActionCreators = {
    get PreloadedUserSettingsActionCreators(): any { return find(value => value?.ProtoClass?.typeName?.endsWith('.PreloadedUserSettings'), 'preloaded user settings'); }
};
export function getCurrentGuild(): { id: string } | undefined {
    const channelId = store('SelectedChannelStore').getChannelId();
    const guildId = ChannelStore.getChannel(channelId)?.guild_id;
    return guildId ? findByPropsLazy('getGuild', 'getGuilds').getGuild(guildId) : undefined;
}
export class Logger {
    constructor(_name: string) {}
    error(...values: unknown[]): void { context.log.error(...values); }
}
export function openModal(render: (props: any) => MenuElement, options: { onCloseCallback?(): void } = {}): string {
    const activation = context;
    checkActive(activation);
    const open = findByCodeLazy(',instant:');
    const close = findByCodeLazy('.onCloseCallback()');
    const key: string = open(render, { ...options, onCloseCallback() { modals.delete(key); options.onCloseCallback?.(); } });
    modals.set(key, () => { close(key); options.onCloseCallback?.(); });
    return key;
}
export function stopContext(): void { for (const close of [...modals.values()]) close(); modals.clear(); }
type LegacyMessage = { content: string; validNonShortcutEmojis?: any[]; [key: string]: any };
type LegacyResult = void | { cancel?: boolean };
export function addMessagePreSendListener(callback: (channelId: string, message: LegacyMessage, options: { stickerIds?: string[] }) => LegacyResult | Promise<LegacyResult>): Disposer {
    return context.messages.beforeSend(async (event: BeforeSendEvent) => {
        const result = await callback(event.channelId, event.message, event.options);
        if (result?.cancel) event.cancel();
    });
}
export function addMessagePreEditListener(callback: (channelId: string, messageId: string, message: LegacyMessage) => LegacyResult | Promise<LegacyResult>): Disposer {
    return context.messages.beforeEdit(async (event: BeforeEditEvent) => {
        const result = await callback(event.channelId, event.messageId, event.message);
        if (result?.cancel) event.cancel();
    });
}
export function removeMessagePreSendListener(dispose?: Disposer): void { dispose?.(); }
export function removeMessagePreEditListener(dispose?: Disposer): void { dispose?.(); }

interface LegacyReplacement { match: string | RegExp; replace: string | ((...args: any[]) => string); predicate?(): boolean }
export interface LegacyPatch { find: string; replacement: LegacyReplacement | LegacyReplacement[]; predicate?(): boolean; all?: boolean; group?: boolean }
// Discord's message-key hashes, calculated with the same xxHash64/base64 mapping as discord-intl.
const messageKeys: Record<string, string> = {
    STREAM_FPS_OPTION: '["bW+JCW"]',
    STICKER_POPOUT_UNJOINED_PRIVATE_GUILD_DESCRIPTION: '.hGWuxU',
    EMOJI_POPOUT_UNJOINED_DISCOVERABLE_GUILD_DESCRIPTION: '.FJ6Z01'
};
function expandReplacement(replacement: string, args: any[]): string {
    const [match] = args;
    const captures = args.slice(1, -2), offset = args.at(-2), source = args.at(-1);
    return replacement.replace(/\$(\$|&|`|'|\d{1,2})/g, (token, key: string) => {
        if (key === '$') return '$';
        if (key === '&') return match;
        if (key === '`') return source.slice(0, offset);
        if (key === "'") return source.slice(offset + match.length);
        const index = Number(key) - 1;
        return index >= 0 && index < captures.length ? captures[index] ?? '' : token;
    });
}
export function normalizePatches(definitions: LegacyPatch[]): SourcePatch[] {
    const names = ['capabilities', 'voice-picker-intention', 'emoji-availability', 'subscription-emoji', 'sticker-availability', 'stream-quality', 'local-theme-settings', 'theme-selection', 'theme-editor', 'inline-expressions', 'media-rendering', 'sticker-notice', 'emoji-popout-node', 'emoji-notice', 'app-icons', 'soundboard'];
    return definitions.map((patch, index) => ({
        id: names[index], find: patch.find.replace(/#\{intl::(\w+)\}/g, (_match, key: string) => {
            if (!messageKeys[key]) throw new Error(`Unknown Discord message key: ${key}`);
            return messageKeys[key];
        }), ...(patch.all ? { all: true } : {}),
        replacement: (Array.isArray(patch.replacement) ? patch.replacement : [patch.replacement]).map(replacement => ({
            match: replacement.match instanceof RegExp ? new RegExp(replacement.match.source.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)'), replacement.match.flags) : replacement.match,
            replace(...args: any[]): string {
                if (patch.predicate?.() === false || replacement.predicate?.() === false) return args[0];
                const result = typeof replacement.replace === 'function' ? replacement.replace(...args) : expandReplacement(replacement.replace, args);
                return result.replaceAll('$self', '$self.plugin');
            }
        }))
    }));
}
