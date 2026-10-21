/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
let context: RendererContext | undefined;
export const patches: SourcePatch[] = [
    { id: 'tab-data-attributes', find: '.tabBarRef', replacement: {
        match: /style:this\.getStyle\(\),role:[A-Za-z_$][\w$]*/,
        replace: "$&,'data-tab-id':$self.getTabId(this?.props?.id)"
    } },
    { id: 'message-data-attributes', find: 'Message must not be a thread starter message', replacement: {
        match: /"aria-setsize":-1,(?=.{0,150}?\.BAB0yK)/,
        replace: '...$self.getMessageProps(arguments[0]),$&'
    } },
    { id: 'profile-avatar-css-variables', find: '["/6mw10"]', replacement: {
        match: /src:([A-Za-z_$][\w$]*)\?\?void 0.{1,50}"aria-hidden":!0/,
        replace: '$&,style:$self.getAvatarStyles($1)'
    } },
    { id: 'message-avatar-css-variables', find: 'showCommunicationDisabledStyles', replacement: {
        match: /src:([A-Za-z_$][\w$]*),"aria-hidden":!0/,
        replace: '$&,style:$self.getAvatarStyles($1)'
    } }
];
export function getTabId(id: unknown): unknown { return context && !context.signal.aborted ? id : undefined; }
export function getMessageProps({ message }: { message?: { author?: { id: string; username: string } } }): Record<string, unknown> {
    const ctx = context;
    if (!ctx || ctx.signal.aborted) return {};
    const author = message?.author;
    const users = ctx.webpack.find<{ getCurrentUser(): { id: string } | undefined }>(value => value?.getName?.() === 'UserStore');
    return { 'data-author-id': author?.id, 'data-author-username': author?.username, 'data-is-self': author?.id ? author.id === users?.getCurrentUser()?.id : undefined };
}
export function getAvatarStyles(source: unknown): Record<string, string> {
    if (!context || context.signal.aborted || typeof source !== 'string' || !source || source.startsWith('data:')) return {};
    let url: URL;
    try { url = new URL(source, globalThis.location?.href ?? 'https://discord.com'); } catch { return {}; }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return {};
    return Object.fromEntries([128, 256, 512, 1024, 2048, 4096].map(size => {
        const sized = new URL(url);
        if (sized.searchParams.has('size') || /^(?:cdn\.discordapp\.com|media\.discordapp\.net)$/.test(sized.hostname)) sized.searchParams.set('size', String(size));
        return [`--avatar-url-${size}`, `url(${JSON.stringify(sized.href)})`];
    }));
}
export function start(ctx: RendererContext): void { context = ctx; }
export function stop(): void { context = undefined; }
