/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later */
import type { RendererContext } from '@bedrock/renderer';
import { accountTarget, linkTarget } from './rules.js';
export { settings } from './settings.js';
type MainContext = Pick<RendererContext, 'id' | 'signal' | 'events' | 'settings'>;
type Shell = { openExternal(uri: string): Promise<void> };

export async function resolveRedirect(source: string, signal: AbortSignal): Promise<string> {
    let current = source;
    for (let count = 0; count < 8; count++) {
        let response: Response;
        try { response = await fetch(current, { method: 'HEAD', redirect: 'manual', credentials: 'omit', signal }); }
        catch (error) { throw new Error(`Could not resolve ${JSON.stringify(current)}: ${error instanceof Error ? error.message : String(error)}`, { cause: error }); }
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (!location) throw new Error(`Redirect from ${JSON.stringify(current)} has no Location header (HTTP ${response.status}).`);
            let next: URL;
            try { next = new URL(location, current); }
            catch { throw new Error(`Invalid redirect Location ${JSON.stringify(location)} from ${JSON.stringify(current)}.`); }
            if (next.protocol !== 'https:' || next.username || next.password || next.port)
                throw new Error(`Invalid redirect URL ${JSON.stringify(next.href)} from ${JSON.stringify(current)}. Expected HTTPS without credentials or a custom port.`);
            current = next.href;
            continue;
        }
        if (!response.ok) throw new Error(`Could not resolve ${JSON.stringify(current)}: HTTP ${response.status} ${response.statusText}.`);
        return current;
    }
    throw new Error(`Could not resolve ${JSON.stringify(source)}: more than eight redirects.`);
}

export function start(ctx: MainContext): void {
    const { shell } = (Bedrock as unknown as { require(name: string): { shell: Shell } }).require('electron');
    ctx.events.on('open-in-app.request', async ({ id, value }) => {
        if (id !== ctx.id || typeof value?.requestId !== 'string' || value.requestId.length > 100) return;
        try {
            let target;
            if (value.kind === 'account') target = accountTarget(value.platform, value.accountId);
            else if (value.kind === 'link') {
                if (typeof value.url !== 'string') throw new Error(`Invalid link URL: ${JSON.stringify(value.url)}. Expected a string.`);
                target = linkTarget(value.url);
                if (target && !ctx.settings.get(target.app, true)) target = undefined;
                if (target?.short) {
                    const resolved = await resolveRedirect(value.url, AbortSignal.any([ctx.signal, AbortSignal.timeout(15000)]));
                    target = linkTarget(resolved);
                    if (!target?.uri || !ctx.settings.get(target.app, true)) {
                        if (ctx.signal.aborted) return;
                        await shell.openExternal(resolved);
                        await ctx.events.emit('open-in-app.response', { requestId: value.requestId, opened: true });
                        return;
                    }
                }
            } else throw new Error(`Invalid Open In App operation: ${JSON.stringify(value.kind)}.`);
            if (!target?.uri || !ctx.settings.get(target.app, true))
                throw new Error(`No enabled app matches ${JSON.stringify(value.kind === 'account' ? `${value.platform}:${value.accountId}` : value.url)}.`);
            if (ctx.signal.aborted) return;
            try { await shell.openExternal(target.uri); }
            catch (error) { throw new Error(`Could not open ${JSON.stringify(target.uri)}: ${error instanceof Error ? error.message : String(error)}`, { cause: error }); }
            if (!ctx.signal.aborted) await ctx.events.emit('open-in-app.response', { requestId: value.requestId, opened: true });
        } catch (error) {
            if (!ctx.signal.aborted) await ctx.events.emit('open-in-app.response', { requestId: value.requestId, error: error instanceof Error ? error.message : String(error) });
        }
    });
}
