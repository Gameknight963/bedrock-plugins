/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext } from '@bedrock/renderer';

type MainContext = Pick<RendererContext, 'id' | 'signal' | 'events'>;
const rulesUrl = 'https://raw.githubusercontent.com/ClearURLs/Rules/master/data.min.json';

export function start(ctx: MainContext): void {
    let download: Promise<unknown> | undefined;
    function downloadRules(): Promise<unknown> {
        if (download) return download;
        const signal = AbortSignal.any([ctx.signal, AbortSignal.timeout(15000)]);
        download = (async () => {
            let operation = 'download';
            try {
                const response = await fetch(rulesUrl, { signal, credentials: 'omit' });
                if (!response.ok) throw new Error(`HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`);
                operation = 'read';
                const data: unknown = await response.json();
                if (!data || typeof data !== 'object' || !('providers' in data) || !data.providers || typeof data.providers !== 'object' || Array.isArray(data.providers))
                    throw new Error('The rules file has no providers.');
                return data;
            } catch (error) {
                const detail = signal.aborted && signal.reason?.name === 'TimeoutError' ? 'Request timed out after 15 seconds.' :
                    error instanceof Error ? error.message : String(error);
                throw new Error(`Could not ${operation} ClearURLs rules from ${rulesUrl}: ${detail}`, { cause: error });
            }
        })().catch(error => { download = undefined; throw error; });
        return download;
    }
    ctx.events.on('clearurls.rules.request', async ({ id, value }) => {
        if (id !== ctx.id || typeof value?.requestId !== 'string' || value.requestId.length > 100) return;
        let response: { requestId: string; data?: unknown; error?: string };
        try { response = { requestId: value.requestId, data: await downloadRules() }; }
        catch (error) { response = { requestId: value.requestId, error: error instanceof Error ? error.message : String(error) }; }
        if (!ctx.signal.aborted) await ctx.events.emit('clearurls.rules.response', response);
    });
}
