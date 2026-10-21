/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
import { accountTarget, linkTarget } from './rules.js';
import { settings } from './settings.js';
export { settings };
let context: RendererContext | undefined;
const identifier = '(?:[A-Za-z_$][\\w$]*)';
const re = (source: string) => new RegExp(source.replaceAll('\\i', identifier));
export const patches: SourcePatch[] = [
    { id: 'open-links-in-app', find: 'trackAnnouncementMessageLinkClicked({', replacement: {
        match: re(String.raw`function (\i\(\i,\i\)\{)(?=.{0,150}trusted:)`),
        replace: 'async function $1if(await $self.handleLink(...arguments))return;'
    } },
    ...['.__invalid_connectedAccountOpenIconContainer', '.BLUESKY||'].map((find, index) => ({
        id: `open-connected-account-${index}`, find, replacement: {
            match: re(String.raw`(?<=onClick:(\i)=>\{)(?=.{0,100}\.CONNECTED_ACCOUNT_VIEWED)(?<==(\i)\.metadata.+?)`),
            replace: 'if($self.handleAccountView($1,$2.type,$2.id))return;'
        }
    }))
];

function request(value: Record<string, unknown>): Promise<void> {
    const ctx = context;
    if (!ctx || ctx.signal.aborted) return Promise.reject(new Error('Open In App is not active.'));
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
        let unsubscribe = () => {};
        let finished = false;
        const finish = (error?: Error) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            unsubscribe();
            ctx.signal.removeEventListener('abort', abort);
            if (error) reject(error); else resolve();
        };
        const abort = () => finish(new Error('Open In App was disabled before the link opened.'));
        const timer = setTimeout(() => finish(new Error(`The main process did not respond within 20 seconds while opening ${JSON.stringify(value.url ?? `${value.platform}:${value.accountId}`)}.`)), 20000);
        ctx.signal.addEventListener('abort', abort, { once: true });
        if (ctx.signal.aborted) { abort(); return; }
        unsubscribe = ctx.events.on('open-in-app.response', ({ id, value: response }) => {
            if (id !== ctx.id || response?.requestId !== requestId) return;
            finish(typeof response.error === 'string' ? new Error(response.error) : response.opened === true ? undefined : new Error('Open In App received a response without an opening result.'));
        });
        void ctx.events.emit('open-in-app.request', { ...value, requestId }).catch(error => finish(error instanceof Error ? error : new Error(String(error))));
    });
}
function report(error: unknown, ctx: RendererContext): void {
    if (ctx.signal.aborted) return;
    const message = error instanceof Error ? error.message : String(error);
    ctx.log.error(message);
    ctx.notifications.show({ title: 'Could not open link in app', body: message, type: 'error' });
}
export async function handleLink(data: { href?: string } | undefined, event?: { preventDefault(): void }): Promise<boolean> {
    if (!context || context.signal.aborted || typeof data?.href !== 'string') return false;
    const target = linkTarget(data.href);
    if (!target || !settings.store[target.app]) return false;
    const ctx = context;
    event?.preventDefault();
    try { await request({ kind: 'link', url: data.href }); }
    catch (error) { report(error, ctx); }
    return true;
}
export function handleAccountView(event: { preventDefault(): void }, platform: string, accountId: string): boolean {
    if (!context || context.signal.aborted || !settings.store[platform]) return false;
    try {
        if (!accountTarget(platform, accountId)) return false;
        event.preventDefault();
        const ctx = context;
        void request({ kind: 'account', platform, accountId }).catch(error => report(error, ctx));
        return true;
    } catch (error) { report(error, context); return false; }
}
export function start(ctx: RendererContext): void { context = ctx; }

export function stop(): void { context = undefined; }
