/* Copyright (c) 2023-2026 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, ReactRuntime } from '@bedrock/renderer';
let context: RendererContext;
export function setContext(ctx: RendererContext): void { context = ctx; }
export function isActive(): boolean { return !!context && !context.signal.aborted; }
export const classNameFactory = (prefix: string) => (suffix: string) => prefix + suffix;
export const Tooltip = (props: any): any => React.createElement(find(value => typeof value === 'function' && value.prototype?.shouldShowTooltip && value.prototype?.render, 'tooltip'), props);
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
function store(name: string): any { return lazy(() => find(value => value?.getName?.() === name, name)); }
export const GuildStore = store('GuildStore'), PresenceStore = store('PresenceStore'), RelationshipStore = store('RelationshipStore'), UserGuildJoinRequestStore = store('UserGuildJoinRequestStore');
export const React: ReactRuntime = new Proxy({} as ReactRuntime, { get(_target, key: keyof ReactRuntime) {
    if (key === 'Fragment') return context.react.Fragment;
    return (...args: unknown[]) => Reflect.apply(context.react[key] as Function, context.react, args);
} });
export function BaseText({ tag = 'div', size = 'md', weight = 'normal', style, children, ...props }: any): any {
    return React.createElement(tag, { ...props, style: { fontFamily: 'var(--font-primary)', fontSize: size === 'xs' ? '12px' : '16px', lineHeight: size === 'xs' ? '1.33333' : '1.25', fontWeight: weight === 'medium' ? 500 : 400, margin: 0, color: 'var(--text-default)', ...style } }, children);
}
let Boundary: any;
export const ErrorBoundary = (props: any): any => {
    return boundary(props.children);
};
function boundary(children: any): any {
    if (!isActive()) return null;
    Boundary ||= class extends (context.react as any).Component {
        state = { error: null as Error | null };
        static getDerivedStateFromError(error: Error) { return { error }; }
        componentDidCatch(error: unknown) { context.log.error('Could not display server list indicators.', error); }
        render() { return this.state.error ? null : this.props.children; }
    };
    return React.createElement(Boundary, null, children);
}
export function useStateFromStores(stores: any[], getValue: () => any): any {
    const [, refresh] = React.useState(0);
    React.useEffect(() => {
        const update = () => refresh(value => value + 1);
        for (const store of stores) store.addChangeListener(update);
        return () => { for (const store of stores) store.removeChangeListener(update); };
    }, stores);
    return getValue();
}
declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } interface IntrinsicAttributes { key?: string | number } } }
