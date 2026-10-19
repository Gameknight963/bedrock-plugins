/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext } from '@bedrock/renderer';

interface Provider { urlPattern: string; rules?: string[]; rawRules?: string[]; exceptions?: string[] }
interface RuleSet { urlPattern: RegExp; rules: RegExp[]; rawRules: RegExp[]; exceptions: RegExp[] }
let rules: RuleSet[] = [];

export async function start(ctx: RendererContext): Promise<void> {
    ctx.reportStatus('Downloading URL cleaning rules');
    const response = await fetch('https://raw.githubusercontent.com/ClearURLs/Rules/master/data.min.json', {
        signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(15000)]), credentials: 'omit'
    });
    if (!response.ok) throw new Error(`Could not download ClearURLs rules (HTTP ${response.status}).`);
    const data = await response.json() as { providers: Record<string, Provider> };
    if (!data.providers || typeof data.providers !== 'object') throw new Error('The ClearURLs rules file has no providers.');
    const prepared = Object.values(data.providers).map(provider => ({
        urlPattern: new RegExp(provider.urlPattern, 'i'),
        rules: (provider.rules ?? []).map(rule => new RegExp(rule, 'i')),
        rawRules: (provider.rawRules ?? []).map(rule => new RegExp(rule, 'i')),
        exceptions: (provider.exceptions ?? []).map(rule => new RegExp(rule, 'i'))
    }));
    if (ctx.signal.aborted) return;
    rules = prepared;
    ctx.messages.beforeSend(({ message }) => { message.content = cleanMessage(message.content); });
    ctx.messages.beforeEdit(({ message }) => { message.content = cleanMessage(message.content); });
    ctx.reportStatus('');
}

export function cleanUrl(match: string): string {
    try {
        let url = new URL(match);
        if (!url.search) return match;
        const original = url.href;
        for (const provider of rules) {
            if (!provider.urlPattern.test(url.href) || provider.exceptions.some(rule => rule.test(url.href))) continue;
            const parameters: string[] = [];
            url.searchParams.forEach((_, key) => { if (provider.rules.some(rule => rule.test(key))) parameters.push(key); });
            for (const key of parameters) url.searchParams.delete(key);
            let cleaned = url.href;
            for (const rule of provider.rawRules) cleaned = cleaned.replace(rule, '');
            url = new URL(cleaned);
            if (!['http:', 'https:'].includes(url.protocol)) return match;
        }
        return url.href === original ? match : url.href;
    } catch { return match; }
}
export function cleanMessage(content: string): string {
    return content.replace(/(https?:\/\/[^\s<]+[^<.,:;"'>)|\]\s])/g, cleanUrl);
}
export function stop(): void { rules = []; }
