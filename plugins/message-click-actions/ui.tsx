/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { ReactRuntime, RendererSettingsContext } from '@bedrock/renderer';
import { getUiContext, setUiContext } from './adapter.js';
declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } interface IntrinsicAttributes { key?: string | number } } }
let runtime: ReactRuntime;
let UiContext: any;
export function setReact(react: ReactRuntime): void { runtime = react; }
export const React: ReactRuntime = new Proxy({} as ReactRuntime, { get(_target, key: keyof ReactRuntime) {
    if (key === 'Fragment') return runtime.Fragment;
    return (...args: unknown[]) => Reflect.apply(runtime[key] as Function, runtime, args);
} });
export const useState = React.useState, useRef = React.useRef;
function useContext(): RendererSettingsContext { return (runtime as any).useContext(UiContext); }
export function EditorProvider({ ctx, children }: any): any {
    runtime = ctx.react; setUiContext(ctx);
    UiContext ||= (runtime as any).createContext(null);
    runtime.useEffect(() => {
        void fetch(new URL('./styles.css', import.meta.url), { signal: ctx.signal }).then(response => {
            if (!response.ok) throw new Error(`Could not load reaction settings styles (HTTP ${response.status}).`);
            return response.text();
        }).then(css => { if (!ctx.signal.aborted) ctx.styles.add(css); }).catch(error => { if (!ctx.signal.aborted) ctx.log.error(error); });
    }, [ctx]);
    return runtime.createElement(UiContext.Provider, { value: ctx }, children);
}
export function Heading({ children }: any): any { return <h3 style={{ fontSize: 16, fontWeight: 600, margin: '20px 0 8px' }}>{children}</h3>; }
export const classNameFactory = (prefix: string) => (name: string) => `${prefix}${name}`;
export function findComponentByCodeLazy<T>(...parts: string[]): any {
    return (props: T) => {
        const ctx = useContext();
        const component = ctx.webpack.find(value => { const fn = value?.type ?? value?.render ?? value; return typeof fn === 'function' && parts.every(part => String(fn).includes(part)); });
        if (!component) throw new Error('Discord reaction emoji picker is not available.');
        return ctx.react.createElement(component, props as Record<string, unknown>);
    };
}
export const Popout = findComponentByCodeLazy('ref:this.ref,', 'renderPopout:this.renderPopout,');
export const TextInput = findComponentByCodeLazy('setHasValue?.(""!==', '="text",');
function storeProxy(predicate: (value: any) => boolean): any {
    return new Proxy({}, { get(_target, key) { const store = getUiContext().webpack.find<any>(predicate); if (!store) return undefined; const value = store[key]; return typeof value === 'function' ? value.bind(store) : value; } });
}
export const ChannelStore = storeProxy(value => typeof value?.getChannel === 'function' && typeof value?.getDMFromUserId === 'function');
export const SelectedChannelStore = storeProxy(value => typeof value?.getChannelId === 'function' && typeof value?.getLastSelectedChannelId === 'function');
export const IconUtils = storeProxy(value => typeof value?.getGuildBannerURL === 'function' && typeof value?.getUserAvatarURL === 'function');
export function useStateFromStores<T>(stores: any[], getSnapshot: () => T): T {
    const [, update] = runtime.useState(0);
    runtime.useEffect(() => {
        const refresh = () => update(value => value + 1);
        for (const store of stores) store.addChangeListener?.(refresh);
        return () => { for (const store of stores) store.removeChangeListener?.(refresh); };
    }, stores);
    return getSnapshot();
}
