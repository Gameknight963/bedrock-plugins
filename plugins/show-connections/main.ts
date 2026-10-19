/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { RendererContext } from '@bedrock/renderer';
type MainContext = Pick<RendererContext, 'id' | 'signal' | 'events' | 'log'>;
const usernamePattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
export function validateUsername(value: unknown): string {
    if (typeof value !== 'string' || !usernamePattern.test(value)) throw new Error(`Invalid GitHub username ${JSON.stringify(value)}; expected 1 to 39 letters, digits or hyphens, beginning and ending with a letter or digit.`);
    return value;
}
export function start(ctx: MainContext): void {
    const requests = new Map<string, Promise<Array<{ login: string }>>>();
    const cache = new Map<string, { time: number; data: Array<{ login: string }> }>();
    async function organizations(username: string): Promise<Array<{ login: string }>> {
        const key = username.toLowerCase(), existing = cache.get(key);
        if (existing && Date.now() - existing.time < 300000) return existing.data;
        const active = requests.get(key);
        if (active) return active;
        const request = (async () => {
            const url = `https://api.github.com/users/${encodeURIComponent(username)}/orgs?per_page=100`;
            const signal = AbortSignal.any([ctx.signal, AbortSignal.timeout(15000)]);
            let response: Response;
            try { response = await fetch(url, { signal, credentials: 'omit', redirect: 'error', headers: { accept: 'application/vnd.github+json' } }); }
            catch (error) {
                const detail = signal.reason?.name === 'TimeoutError' ? 'Request timed out after 15 seconds.' : error instanceof Error ? error.message : String(error);
                throw new Error(`Could not fetch GitHub organizations from ${url}: ${detail}`, { cause: error });
            }
            if (!response.ok) throw new Error(`GitHub organization lookup for ${JSON.stringify(username)} failed: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}.`);
            const data: unknown = await response.json();
            if (!Array.isArray(data)) throw new Error(`GitHub organization response for ${JSON.stringify(username)} must be an array.`);
            const result = data.map((org: unknown, index: number) => {
                if (!org || typeof org !== 'object' || !('login' in org) || typeof org.login !== 'string' || !usernamePattern.test(org.login))
                    throw new Error(`GitHub organization response entry ${index} has an invalid login.`);
                return { login: org.login };
            });
            cache.delete(key); cache.set(key, { time: Date.now(), data: result });
            if (cache.size > 128) cache.delete(cache.keys().next().value!);
            return result;
        })();
        requests.set(key, request);
        try { return await request; } finally { if (requests.get(key) === request) requests.delete(key); }
    }
    ctx.events.on('connections.github.request', async ({ id, value }) => {
        if (id !== ctx.id || ctx.signal.aborted || typeof value?.requestId !== 'string' || !value.requestId || value.requestId.length > 100) return;
        const response: { requestId: string; data?: Array<{ login: string }>; error?: string } = { requestId: value.requestId };
        try { response.data = await organizations(validateUsername(value.username)); }
        catch (error) { response.error = error instanceof Error ? error.message : String(error); }
        if (!ctx.signal.aborted) await ctx.events.emit('connections.github.response', response);
    });
    ctx.events.on('connections.xbox.open', async ({ id, value }) => {
        if (id !== ctx.id || ctx.signal.aborted) return;
        try {
            if (typeof value?.name !== 'string' || !value.name || value.name.length > 64 || /[\u0000-\u001f\u007f]/.test(value.name))
                throw new Error(`Invalid Xbox profile name ${JSON.stringify(value?.name)}; expected 1 to 64 printable characters.`);
            const { shell } = (Bedrock as unknown as { require(name: string): { shell: { openExternal(url: string): Promise<void> } } }).require('electron');
            await shell.openExternal(`https://www.xbox.com/en-US/play/user/${encodeURIComponent(value.name)}`);
        } catch (error) { ctx.log.error('Could not open the Xbox profile.', error); }
    });
}
