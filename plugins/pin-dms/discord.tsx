/* Copyright (c) 2024-2026 Vendicated and Bedrock contributors. SPDX-License-Identifier: GPL-3.0-or-later */
import type { Disposer, ReactRuntime, RendererContext, SourcePatch } from '@bedrock/renderer';
import type { Category } from './data.js';
export type NavContextMenuPatchCallback = (children: any[], props: any) => void;
export type RenderModalProps = Record<string, any>;
let context: RendererContext;
let categories: Record<string, Category[]> = {};
let collapsed = false;
let colorPicker: any;
const disposers = new Set<Disposer>();
const modals = new Map<string, () => void>();
function find(predicate: (value: any) => boolean, name: string): any {
    const value = context.webpack.find(predicate);
    if (!value) throw new Error(`Discord's ${name} is not available.`);
    return value;
}
function lazy(factory: () => any): any {
    return new Proxy(function () {}, {
        get(_target, key) { const value = factory(), property = value[key]; return typeof property === 'function' ? property.bind(value) : property; },
        apply(_target, receiver, args) { return Reflect.apply(factory(), receiver, args); }
    });
}
function byCode(name: string, ...parts: string[]): any {
    return find(value => {
        const component = value?.type || value?.render || value;
        return typeof component === 'function' && parts.every(part => String(component).includes(part));
    }, name);
}
export const React: ReactRuntime = new Proxy({} as ReactRuntime, { get(_target, key: keyof ReactRuntime) {
    if (key === 'Fragment') return context.react.Fragment;
    return (...args: unknown[]) => Reflect.apply(context.react[key] as Function, context.react, args);
} });
export const useMemo = React.useMemo, useState = React.useState;
const store = (name: string): any => lazy(() => find(value => value?.getName?.() === name, name));
export const UserStore = store('UserStore'), PrivateChannelSortStore = store('PrivateChannelSortStore');
export const FluxDispatcher = lazy(() => find(value => value?.dispatch && value?.subscribe && value?.wait, 'dispatcher'));
export const ContextMenuApi = lazy(() => find(value => value?.openContextMenu && value?.closeContextMenu, 'context menus'));
export const Menu = lazy(() => find(value => value?.Menu && value?.MenuItem && value?.MenuGroup, 'menu components'));
export const Clickable = (props: any): any => React.createElement(byCode('clickable', 'this.context?this.renderNonInteractive():'), props);
export const TextInput = (props: any): any => React.createElement(byCode('text input', 'setHasValue?.(""!==', '="text",'), props);
export const Modal = (props: any): any => React.createElement(byCode('modal', 'leadingLayout:', 'actions:', '.message'), props);
export const Heading = ({ tag = 'h5', children }: any): any => React.createElement(tag, { className: 'bedrock-pindms-heading' }, children);
export const ColorPicker = (props: any): any => {
    if (!colorPicker) throw new Error("Discord's custom color picker has not loaded.");
    return React.createElement(colorPicker, props);
};
export function captureColorPicker(component: any): void { colorPicker = component; }
export const classes = (...values: any[]): string => values.filter(Boolean).join(' ');
export const classNameFactory = (prefix: string) => (...values: string[]) => values.map(value => prefix + value).join(' ');
export function findCssClassesLazy(...props: string[]): any { return lazy(() => find(value => props.every(prop => typeof value?.[prop] === 'string'), props.join(', '))); }
export function findComponentByCodeLazy<T = any>(...parts: string[]): any {
    return (props: T): any => React.createElement(byCode(parts[0], ...parts), props as Record<string, unknown>);
}
let Boundary: any;
function BoundaryComponent(props: any): any {
    const NativeReact = context.react as any;
    Boundary ||= class extends NativeReact.Component {
        state = { failed: false };
        static getDerivedStateFromError() { return { failed: true }; }
        componentDidCatch(error: unknown) { context.log.error(error); }
        render() { return this.state.failed ? null : this.props.children; }
    };
    return React.createElement(Boundary, props);
}
export const ErrorBoundary = { wrap(component: any, _options?: unknown): any {
    return (props: any) => React.createElement(BoundaryComponent, null, React.createElement(component, props));
} };
export function findGroupChildrenByChildId(id: string, children: any[]): any[] | undefined {
    if (children.some(child => child?.props?.id === id)) return children;
    for (const child of children) {
        const nested = child?.props?.children;
        if (Array.isArray(nested)) { const group = findGroupChildrenByChildId(id, nested); if (group) return group; }
    }
}
function save(key: string, value: unknown): void {
    const activation = context;
    void activation.settings.set(key, value).catch(error => {
        activation.log.error(error);
        if (!activation.signal.aborted) activation.notifications.show({ title: 'Could not save pinned DMs', body: String(error.message || error), type: 'error' });
    });
}
export function readCategories(userId: string): Category[] {
    const saved = categories[userId];
    if (!Array.isArray(saved)) return [];
    return saved.filter(category => category && typeof category.id === 'string' && typeof category.name === 'string' &&
        Number.isInteger(category.color) && category.color >= 0 && category.color <= 0xffffff &&
        Array.isArray(category.channels) && category.channels.every(id => typeof id === 'string'));
}
export function writeCategories(userId: string, value: Category[]): void {
    categories[userId] = value;
    save('userBasedCategoryList', structuredClone(categories));
}
export function getCollapsed(): boolean { return collapsed; }
export function setCollapsed(value: boolean): void { collapsed = value; save('dmSectionCollapsed', value); }
export async function startContext(ctx: RendererContext, init: () => void): Promise<void> {
    context = ctx;
    const saved = ctx.settings.get<Record<string, Category[]>>('userBasedCategoryList', {});
    categories = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    collapsed = ctx.settings.get<boolean>('dmSectionCollapsed', false) === true;
    await ctx.webpack.waitFor(value => value?.getName?.() === 'UserStore');
    if (ctx.signal.aborted) return;
    const dispatcher = await ctx.webpack.waitFor<any>(value => value?.subscribe && value?.unsubscribe && value?.dispatch);
    if (ctx.signal.aborted) return;
    for (const event of ['CONNECTION_OPEN', 'LOGOUT']) {
        dispatcher.subscribe(event, init);
        disposers.add(() => dispatcher.unsubscribe(event, init));
    }
    const response = await fetch(new URL('./styles.css', import.meta.url), { signal: ctx.signal });
    if (!response.ok) throw new Error(`Could not load Pin DMs styles (HTTP ${response.status}).`);
    const css = await response.text();
    if (!ctx.signal.aborted) disposers.add(ctx.styles.add(css));
}
export function stopContext(): void {
    for (const dispose of disposers) dispose();
    disposers.clear();
    for (const close of modals.values()) close();
    modals.clear();
    categories = {};
}
export async function loadSettingsModal(): Promise<void> {
    if (context.signal.aborted) return;
    if (colorPicker && context.webpack.find(value => {
        const component = value?.type || value?.render || value;
        return typeof component === 'function' && String(component).includes('id:"color-picker"');
    })) return;
    await context.webpack.loadChunks({ find: ['type:"USER_SETTINGS_MODAL_OPEN"'] });
}
export async function openModalLazy(prepare: () => Promise<(props: RenderModalProps) => any>): Promise<void> {
    const activation = context;
    try {
        const render = await prepare();
        if (activation !== context || activation.signal.aborted) return;
        const open = byCode('modal opener', ',instant:');
        const close = byCode('modal closer', '.onCloseCallback()');
        const key = open(render, { onCloseCallback() { modals.delete(key); } });
        modals.set(key, () => close(key));
    } catch (error: any) {
        if (activation.signal.aborted) return;
        activation.log.error(error);
        activation.notifications.show({ title: 'Could not open the category editor', body: String(error.message || error), type: 'error' });
    }
}
export function normalizePatches(original: any[]): SourcePatch[] {
    const extra = { find: '.Qp04hK}),focusProps:', replacement: {
        match: /(?=function (\i)\(\i\)\{let\{onChange:\i,onClose:\i,[^}]+?showEyeDropper:)/,
        replace: '$self.captureColorPicker($1);'
    } };
    return [...original, extra].map((patch, index) => ({ id: ['dm-list', 'dm-list-updates', 'keyboard-navigation', 'unread-navigation', 'category-color-picker'][index],
        find: patch.find, replacement: { match: /^[\s\S]*$/, replace(source: string): string {
            for (const replacement of Array.isArray(patch.replacement) ? patch.replacement : [patch.replacement]) {
                const match = new RegExp(replacement.match.source.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)'), replacement.match.flags);
                if (!match.test(source)) throw new Error(`Pin DMs replacement did not match: ${replacement.match}`);
                const replace = replacement.replace.replaceAll('$self', index === original.length ? '$self' : '$self.plugin');
                source = source.replace(match, replace);
            }
            return source;
        } }
    }));
}
