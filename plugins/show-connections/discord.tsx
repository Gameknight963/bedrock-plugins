/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { ReactRuntime, RendererContext } from '@bedrock/renderer';
let context: RendererContext | undefined;
let Boundary: any;
const pending = new Set<(error: Error) => void>();
export function setContext(ctx: RendererContext): void { context = ctx; }
export function getContext(): RendererContext | undefined { return context; }
export function isActive(activation = context): boolean { return !!activation && activation === context && !activation.signal.aborted; }
export function stopContext(): void { for (const cancel of pending) cancel(new Error('Show Connections was disabled.')); pending.clear(); context = undefined; }
function ctx(): RendererContext { if (!context) throw new Error('Show Connections is disabled.'); return context; }
function find(predicate: (value: any) => boolean, name: string): any {
    const result = ctx().webpack.find(predicate);
    if (!result) throw new Error(`Discord's ${name} is not available.`);
    return result;
}
export const React: ReactRuntime = new Proxy({} as ReactRuntime, { get(_target, key: keyof ReactRuntime) {
    if (key === 'Fragment') return ctx().react.Fragment;
    return (...args: unknown[]) => Reflect.apply(ctx().react[key] as Function, ctx().react, args);
} });
export const useState = React.useState, useEffect = React.useEffect;
export function findLazy(predicate: (value: any) => boolean): any {
    return new Proxy({}, { get(_target, key) { const object = find(predicate, 'connection helpers'); const value = object[key]; return typeof value === 'function' ? value.bind(object) : value; } });
}
export function findByPropsLazy(...props: string[]): any { return findLazy(value => props.every(prop => value?.[prop] !== undefined)); }
export function findByCodeLazy(...parts: string[]): any {
    return (...args: any[]) => find(value => typeof value === 'function' && parts.every(part => String(value).includes(part)), parts.join(', '))(...args);
}
export function findComponentByCodeLazy(...parts: string[]): any {
    return (props: any) => React.createElement(find(value => { const fn = value?.type ?? value?.render ?? value; return typeof fn === 'function' && parts.every(part => String(fn).includes(part)); }, 'connection verification icon'), props);
}
export function useToken(token: unknown): any {
    return find(value => typeof value === 'function' && String(value).includes('.resolve({theme:') && String(value).includes('"refresh-fast-follow-avatars"') && !String(value).includes('useMemo'), 'theme token hook')(token);
}
export function getIntlMessage(name: string): string {
    const hashes: Record<string, string> = { CONNECTION_VERIFIED: '6H6h1r' };
    const messages = find(value => value?.[Symbol.toStringTag] === 'IntlMessagesProxy', 'message translations');
    return find(value => typeof value?.intl?.string === 'function', 'localization').intl.string(messages[hashes[name]]);
}
export function Tooltip(props: any): any { return React.createElement(find(value => typeof value === 'function' && value.prototype?.shouldShowTooltip && value.prototype?.render, 'tooltip'), props); }
export function Flex({ gap, flexWrap, children }: any): any { return <div style={{ display: 'flex', gap, flexWrap }}>{children}</div>; }
export const ErrorBoundary = Object.assign((props: any): any => {
    const activation = ctx(), NativeReact = activation.react as any;
    Boundary ||= class extends NativeReact.Component {
        state = { failed: false };
        static getDerivedStateFromError() { return { failed: true }; }
        componentDidCatch(error: unknown) { activation.log.error('Could not display profile connections.', error); }
        render() { return this.state.failed ? null : this.props.children; }
    };
    return React.createElement(Boundary, props);
}, { wrap(component: any, _options?: unknown): any { return (props: any) => <ErrorBoundary>{React.createElement(component, props)}</ErrorBoundary>; } });
export const UserProfileStore = findLazy(value => typeof value?.getUserProfile === 'function' && typeof value?.addChangeListener === 'function');
export function useStateFromStores(stores: any[], snapshot: () => any): any {
    const [, update] = React.useState(0);
    React.useEffect(() => {
        const refresh = () => update(value => value + 1);
        const removers = stores.map(store => {
            const add = store.addChangeListener, remove = store.removeChangeListener;
            add(refresh);
            return () => remove(refresh);
        });
        return () => { for (const remove of removers) remove(); };
    }, stores);
    return snapshot();
}
export function copyWithToast(value: string): void {
    const activation = ctx();
    void navigator.clipboard.writeText(value).then(() => { if (isActive(activation)) activation.notifications.show({ title: 'Copied to clipboard', type: 'success' }); })
        .catch(error => activation.log.error('Could not copy the connection name.', error));
}
export function openXboxProfile(name: string): void {
    const activation = ctx();
    void activation.events.emit('connections.xbox.open', { name }).catch(error => activation.log.error('Could not open the Xbox profile.', error));
}
export async function fetchGithubOrgs(username: string): Promise<Array<{ login: string }>> {
    const activation = ctx(), requestId = crypto.randomUUID();
    try {
        return await new Promise((resolve, reject) => {
            let unsubscribe = () => {}, finished = false;
            const finish = (error?: Error, data?: Array<{ login: string }>) => {
                if (finished) return;
                finished = true; clearTimeout(timer); unsubscribe(); pending.delete(cancel); activation.signal.removeEventListener('abort', abort);
                if (error) reject(error); else resolve(data ?? []);
            };
            const cancel = (error: Error) => finish(error), abort = () => finish(new Error('Show Connections was disabled.'));
            const timer = setTimeout(() => finish(new Error(`GitHub organization lookup for ${JSON.stringify(username)} did not respond within 20 seconds.`)), 20000);
            pending.add(cancel); activation.signal.addEventListener('abort', abort, { once: true });
            if (activation.signal.aborted) { abort(); return; }
            unsubscribe = activation.events.on('connections.github.response', ({ id, value }) => {
                if (id !== activation.id || value?.requestId !== requestId) return;
                if (typeof value.error === 'string') finish(new Error(value.error));
                else if (!Array.isArray(value.data) || value.data.some((org: any) => typeof org?.login !== 'string')) finish(new Error('GitHub organization response must contain an array of organization logins.'));
                else finish(undefined, value.data);
            });
            void activation.events.emit('connections.github.request', { requestId, username }).catch(error => finish(error instanceof Error ? error : new Error(String(error))));
        });
    } catch (error) { if (isActive(activation)) activation.log.warn('Could not load GitHub organizations.', error); return []; }
}
export function CopyIcon(props: any): any {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...props}><path d="M4 2a2 2 0 0 0-2 2v12h2V4h12V2H4Zm4 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H8Zm0 2h12v12H8V8Z" /></svg>;
}
export function LinkIcon(props: any): any {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...props}><path d="M15 2h7v7h-2V5.41l-9.3 9.3-1.4-1.42L18.59 4H15V2ZM4 4h7v2H4v14h14v-7h2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /></svg>;
}
