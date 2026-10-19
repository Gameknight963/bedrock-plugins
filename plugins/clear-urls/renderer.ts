/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext } from '@bedrock/renderer';

interface Provider { urlPattern: string; rules?: string[]; rawRules?: string[]; exceptions?: string[] }
interface RuleSet { urlPattern: RegExp; rules: RegExp[]; rawRules: RegExp[]; exceptions: RegExp[] }
let rules: RuleSet[] = [];
function requestRules(ctx: RendererContext): Promise<{ providers: Record<string, Provider> }> {
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
        let unsubscribe = () => {};
        let finished = false;
        const finish = (error?: Error, data?: { providers: Record<string, Provider> }) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            unsubscribe();
            ctx.signal.removeEventListener('abort', abort);
            if (error) reject(error); else resolve(data!);
        };
        const abort = () => finish(new Error('ClearURLs was disabled while loading rules.'));
        const timer = setTimeout(() => finish(new Error('The ClearURLs main process did not respond within 20 seconds.')), 20000);
        ctx.signal.addEventListener('abort', abort, { once: true });
        if (ctx.signal.aborted) { abort(); return; }
        unsubscribe = ctx.events.on('clearurls.rules.response', ({ id, value }) => {
            if (id !== ctx.id || value?.requestId !== requestId) return;
            if (typeof value.error === 'string') finish(new Error(value.error));
            else if (!value.data?.providers || typeof value.data.providers !== 'object' || Array.isArray(value.data.providers)) finish(new Error('The ClearURLs rules response has no providers.'));
            else finish(undefined, value.data);
        });
        void ctx.events.emit('clearurls.rules.request', { requestId }).catch(error => finish(error instanceof Error ? error : new Error(String(error))));
    });
}

export async function start(ctx: RendererContext): Promise<void> {
    ctx.reportStatus('Downloading URL cleaning rules');
    const data = await requestRules(ctx);
    let prepared: RuleSet[];
    try {
        prepared = Object.entries(data.providers).map(([name, provider]) => {
            try {
                return {
                    urlPattern: new RegExp(provider.urlPattern, 'i'),
                    rules: (provider.rules ?? []).map(rule => new RegExp(rule, 'i')),
                    rawRules: (provider.rawRules ?? []).map(rule => new RegExp(rule, 'i')),
                    exceptions: (provider.exceptions ?? []).map(rule => new RegExp(rule, 'i'))
                };
            } catch (error) {
                throw new Error(`Provider ${name}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
            }
        });
    } catch (error) {
        if (ctx.signal.aborted) throw error;
        throw new Error(`Could not compile ClearURLs rules: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
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
