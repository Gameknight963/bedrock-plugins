/* Copyright (c) 2022-2026 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, ReactRuntime } from '@bedrock/renderer';
let context: RendererContext;
export function setContext(ctx: RendererContext): void { context = ctx; }
export function getContext(): RendererContext { return context; }
export const React: ReactRuntime = new Proxy({} as ReactRuntime, { get(_target, key: keyof ReactRuntime) {
    if (key === 'Fragment') return context.react.Fragment;
    return (...args: unknown[]) => Reflect.apply(context.react[key] as Function, context.react, args);
} });
function find(predicate: (value: any) => boolean, name: string): any {
    const value = context.webpack.find(predicate);
    if (!value) throw new Error(`Discord's ${name} is not available.`);
    return value;
}
function lazy(factory: () => any): any {
    return new Proxy(function () {}, {
        get(_target, key) { const target = factory(), value = target[key]; return typeof value === 'function' ? value.bind(target) : value; },
        apply(_target, receiver, args) { return Reflect.apply(factory(), receiver, args); }
    });
}
export function findByPropsLazy(...names: string[]): any { return lazy(() => find(value => names.every(name => value?.[name] !== undefined), names.join(', '))); }
export function findByCodeLazy(...markers: string[]): any { return lazy(() => find(value => typeof value === 'function' && markers.every(marker => String(value).includes(marker)), markers.join(', '))); }
export function mapMangledModuleLazy(marker: string, matchers: Record<string, (value: any) => boolean>): any {
    return lazy(() => {
        const values = Object.values(find(value => value && typeof value === 'object' && Object.values(value).some(item => typeof item === 'function' && String(item).includes(marker)), marker));
        return Object.fromEntries(Object.entries(matchers).map(([name, predicate]) => {
            const value = values.find(predicate);
            if (value === undefined) throw new Error(`Discord's ${name} is not available.`);
            return [name, value];
        }));
    });
}
function store(name: string): any { return lazy(() => find(value => value?.getName?.() === name, name)); }
export const ChannelStore = store('ChannelStore'), CollapsedVoiceChannelStore = store('CollapsedVoiceChannelStore'), SortedGuildStore = store('SortedGuildStore'), UserStore = store('UserStore');
export const Menu = { MenuItem: (props: any) => context.contextMenus.item(props) };
export function sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise(resolve => {
        if (signal.aborted) { resolve(); return; }
        const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
        const timer = setTimeout(done, ms);
        signal.addEventListener('abort', done, { once: true });
    });
}
export function findGroupChildrenByChildId(id: string, children: any[]): any[] | undefined {
    if (children.some(child => child?.props?.id === id)) return children;
    for (let index = 0; index < children.length; index++) {
        const child = children[index];
        if (Array.isArray(child)) { const result = findGroupChildrenByChildId(id, child); if (result) return result; continue; }
        const nested = child?.props?.children;
        if (nested == null) continue;
        const normalized = Array.isArray(nested) ? nested : [nested];
        const result = findGroupChildrenByChildId(id, normalized);
        if (result) {
            if (!Array.isArray(nested)) children[index] = React.cloneElement(child, { children: normalized });
            return result;
        }
    }
    return undefined;
}
export function CogWheel(props: any) {
    return (
        <svg width={24} height={24} role="img"
            {...props}
            className={[props.className, "vc-icon", "vc-cog-wheel"].filter(Boolean).join(" ")}
            viewBox="0 0 24 24"
        >
            <path
                fill="currentColor"
                fillRule="evenodd"
                d="M10.56 1.1c-.46.05-.7.53-.64.98.18 1.16-.19 2.2-.98 2.53-.8.33-1.79-.15-2.49-1.1-.27-.36-.78-.52-1.14-.24-.77.59-1.45 1.27-2.04 2.04-.28.36-.12.87.24 1.14.96.7 1.43 1.7 1.1 2.49-.33.8-1.37 1.16-2.53.98-.45-.07-.93.18-.99.64a11.1 11.1 0 0 0 0 2.88c.06.46.54.7.99.64 1.16-.18 2.2.19 2.53.98.33.8-.14 1.79-1.1 2.49-.36.27-.52.78-.24 1.14.59.77 1.27 1.45 2.04 2.04.36.28.87.12 1.14-.24.7-.95 1.7-1.43 2.49-1.1.8.33 1.16 1.37.98 2.53-.07.45.18.93.64.99a11.1 11.1 0 0 0 2.88 0c.46-.06.7-.54.64-.99-.18-1.16.19-2.2.98-2.53.8-.33 1.79.14 2.49 1.1.27.36.78.52 1.14.24.77-.59 1.45-1.27 2.04-2.04.28-.36.12-.87-.24-1.14-.96-.7-1.43-1.7-1.1-2.49.33-.8 1.37-1.16 2.53-.98.45.07.93-.18.99-.64a11.1 11.1 0 0 0 0-2.88c-.06-.46-.54-.7-.99-.64-1.16.18-2.2-.19-2.53-.98-.33-.8.14-1.79 1.1-2.49.36-.27.52-.78.24-1.14a11.07 11.07 0 0 0-2.04-2.04c-.36-.28-.87-.12-1.14.24-.7.96-1.7 1.43-2.49 1.1-.8-.33-1.16-1.37-.98-2.53.07-.45-.18-.93-.64-.99a11.1 11.1 0 0 0-2.88 0ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
                clipRule="evenodd"
            />
        </svg>
    );
}


declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } interface IntrinsicAttributes { key?: string | number } } }
