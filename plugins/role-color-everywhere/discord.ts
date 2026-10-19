/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
let context: RendererContext;
export const setContext = (ctx: RendererContext) => { context = ctx; };
export const getContext = () => context;
function find(predicate: (value: any) => boolean, name: string): any {
    const value = context.webpack.find(predicate);
    if (!value) throw new Error(`Discord's ${name} is not available.`);
    return value;
}
function store(name: string): any {
    return new Proxy({}, { get(_target, key) {
        const target = find(value => value?.getName?.() === name, name), value = target[key];
        return typeof value === 'function' ? value.bind(target) : value;
    } });
}
export const ChannelStore = store('ChannelStore'), GuildMemberStore = store('GuildMemberStore'), GuildRoleStore = store('GuildRoleStore'), GuildStore = store('GuildStore');
export function useMessageAuthor(message: any): any {
    return find(value => typeof value === 'function' && String(value).includes('Result cannot be null because the message is not null'), 'message author hook')(message);
}
export class Logger {
    constructor(_name: string) {}
    error(...values: unknown[]): void { context.log.error(...values); }
}
const hashes: Record<string, string> = { CHANNEL_MEMBERS_A11Y_LABEL: 'Uaqbke', GUEST_NAME_SUFFIX: 'pFO/Ph' };
function canonicalize(value: string, regex = false): string {
    return value.replace(/#\{intl::(\w+)\}/g, (_match, key: string) => {
        const hash = hashes[key];
        if (!hash) throw new Error(`Unknown translation key: ${key}`);
        const property = /^\d/.test(hash) || /[+/]/.test(hash) ? `["${hash}"]` : `.${hash}`;
        return regex ? property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : property;
    }).replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)');
}
export function normalizePatches(definitions: any[]): SourcePatch[] {
    return definitions.map((patch, index) => ({ id: `role-colors-${index}`, find: canonicalize(patch.find), replacement: { match: /^[\s\S]*$/, replace(source: string): string {
        if (!patch.predicate()) return source;
        for (const replacement of Array.isArray(patch.replacement) ? patch.replacement : [patch.replacement]) {
            const match = new RegExp(canonicalize(replacement.match.source, true), replacement.match.flags);
            if (!match.test(source)) throw new Error(`Role Color Everywhere replacement did not match (${replacement.match}).`);
            source = source.replace(match, replacement.replace);
        }
        return source;
    } } }));
}
