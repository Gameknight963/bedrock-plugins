/* Copyright (c) 2023-2026 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, ReactRuntime, SourcePatch } from '@bedrock/renderer';
let context: RendererContext;
let createScroller: ((thin: string, fade: string, custom: string) => any) | undefined;
let Scroller: any;
export function setContext(ctx: RendererContext): void { context = ctx; }
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
function store(name: string): any { return lazy(() => find(value => value?.getName?.() === name, name)); }
export const ChannelStore = store('ChannelStore'), RelationshipStore = store('RelationshipStore'), UserStore = store('UserStore');
export const IconUtils = findByPropsLazy('getGuildBannerURL', 'getUserAvatarURL');
export const UsernameUtils = findByPropsLazy('useName', 'useNick', 'getName');
export const React: ReactRuntime = new Proxy({} as ReactRuntime, { get(_target, key: keyof ReactRuntime) {
    if (key === 'Fragment') return context.react.Fragment;
    return (...args: unknown[]) => Reflect.apply(context.react[key] as Function, context.react, args);
} });
function byCode(name: string, marker: string): any {
    return find(value => { const component = value?.type || value?.render || value; return typeof component === 'function' && String(component).includes(marker); }, name);
}
export const Avatar = (props: any): any => React.createElement(byCode('avatar', '.size-1.375*'), props);
export const Clickable = (props: any): any => React.createElement(byCode('clickable', 'this.context?this.renderNonInteractive():'), props);
export const classes = (...values: any[]) => values.filter(Boolean).join(' ');
export const isNonNullish = (value: any) => value != null;
export function BaseText({ tag = 'div', size = 'md', weight = 'normal', style, children, ...props }: any): any {
    return React.createElement(tag, { ...props, style: { fontFamily: 'var(--font-primary)', fontSize: size === 'xs' ? '12px' : '16px', lineHeight: size === 'xs' ? '1.33333' : '1.25', fontWeight: weight === 'medium' ? 500 : 400, margin: 0, color: 'var(--text-default)', ...style } }, children);
}
export function findCssClassesLazy(...names: string[]): any {
    return lazy(() => {
        const mapped = (value: any, name: string) => typeof value?.[name] === 'string' ? value[name] : Object.values(value || {}).find(item => typeof item === 'string' && item.split(' ').some(part => part.startsWith(name + '_')));
        const value = find(value => names.every(name => mapped(value, name)), names.join(', ') + ' styles');
        return Object.fromEntries(names.map(name => [name, mapped(value, name)]));
    });
}
export function setCreateScroller(factory: (thin: string, fade: string, custom: string) => any): void { createScroller = factory; Scroller = undefined; }
export function ScrollerThin(props: any): any {
    if (!createScroller) throw new Error("Discord's scroller factory has not loaded.");
    if (!Scroller) { const classes = findCssClassesLazy('thin', 'auto', 'fade', 'customTheme', 'none'); Scroller = createScroller(classes.thin, classes.fade, classes.customTheme); }
    return React.createElement(Scroller, props);
}
export class Logger { constructor(_name: string) {} error(...values: unknown[]): void { context.log.error(...values); } }
let Boundary: any;
export const ErrorBoundary = { wrap(component: any, _options?: any): any {
    return (props: any) => {
        if (!context || context.signal.aborted) return null;
        Boundary ||= class extends (context.react as any).Component {
            state = { error: null as Error | null };
            static getDerivedStateFromError(error: Error) { return { error }; }
            componentDidCatch(error: unknown) { context.log.error('Could not display mutual groups.', error); }
            render() { return this.state.error ? null : this.props.children; }
        };
        return React.createElement(Boundary, null, React.createElement(component, props));
    };
} };
export function useStateFromStores(stores: any[], getValue: () => any): any {
    const [, refresh] = React.useState(0);
    React.useEffect(() => {
        const update = () => refresh(value => value + 1);
        for (const store of stores) store.addChangeListener(update);
        return () => { for (const store of stores) store.removeChangeListener(update); };
    }, stores);
    return getValue();
}
export function normalizePatches(definitions: any[]): SourcePatch[] {
    const list = [...definitions, { find: '="ltr",orientation:', replacement: {
        match: /(?=function (\i)\(\i,\i,\i\)\{.{0,20}?return function\(\i\)\{let\{[^}]+?="ltr",orientation:)/, replace: '$self.setCreateScroller($1);'
    } }];
    return list.map((patch, index) => ({ id: `mutual-groups-${index}`, find: patch.find, replacement: { match: /^[\s\S]*$/, replace(source: string): string {
        for (const replacement of Array.isArray(patch.replacement) ? patch.replacement : [patch.replacement]) {
            const match = new RegExp(replacement.match.source.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)'), replacement.match.flags);
            if (!match.test(source)) throw new Error(`Mutual Group DMs replacement did not match (${replacement.match}).`);
            source = source.replace(match, replacement.replace);
        }
        return source;
    } } }));
}
declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } interface IntrinsicAttributes { key?: string | number } } }
