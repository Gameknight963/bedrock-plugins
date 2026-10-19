/* Copyright (c) 2026 Bedrock contributors. SPDX-License-Identifier: GPL-3.0-or-later */
import type { Disposer, ReactRuntime, RendererContext, SourcePatch } from '@bedrock/renderer';

let context: RendererContext;
const subscriptions = new Set<Disposer>();
export function setContext(ctx: RendererContext): void { context = ctx; }
export function stopContext(): void { for (const dispose of subscriptions) dispose(); subscriptions.clear(); }
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
export const React: ReactRuntime = new Proxy({} as ReactRuntime, { get(_target, key: keyof ReactRuntime) {
    if (key === 'Fragment') return context.react.Fragment;
    return (...args: unknown[]) => Reflect.apply(context.react[key] as Function, context.react, args);
} });
export function findByPropsLazy(...props: string[]): any { return lazy(() => find(value => props.every(prop => value?.[prop] !== undefined), props.join(', '))); }
function store(name: string): any { return lazy(() => find(value => value?.getName?.() === name, name)); }
export const ExpandedGuildFolderStore = store('ExpandedGuildFolderStore');
export const SortedGuildStore = store('SortedGuildStore');
export const ChannelRTCStore = store('ChannelRTCStore');
export const FluxDispatcher = findByPropsLazy('dispatch', 'subscribe', 'wait');
function componentCode(value: any, parts: string[]): boolean {
    const component = value?.type || value?.render || value;
    return typeof component === 'function' && parts.every(part => String(component).includes(part));
}
export function findComponentByCodeLazy(...parts: string[]): any {
    return (props: any) => React.createElement(find(value => componentCode(value, parts), parts[0]), props);
}
export const Animations: any = new Proxy({}, { get(_target, key) {
    if (key === 'Transition') return find(value => componentCode(value, ['["items","children"]', ',null,']), 'sidebar animation');
    if (key === 'animated') return find(value => value?.div && value?.text && value?.svg, 'animated elements');
} });
export function useStateFromStores(stores: any[], getValue: () => any): any {
    const [, refresh] = React.useState(0);
    React.useEffect(() => {
        const update = () => refresh(value => value + 1);
        for (const store of stores) store.addChangeListener(update);
        update();
        return () => { for (const store of stores) store.removeChangeListener(update); };
    }, stores);
    return getValue();
}
export const ErrorBoundary = { wrap(component: (props: any) => any, _options?: unknown): (props: any) => any {
    let Boundary: any;
    return props => {
        const React = context.react as any;
        Boundary ||= class extends React.Component {
            state = { failed: false };
            static getDerivedStateFromError() { return { failed: true }; }
            componentDidCatch(error: unknown) { context.log.error(error); }
            render() { return this.state.failed ? null : this.props.children; }
        };
        return React.createElement(Boundary, null, React.createElement(component, props));
    };
} };
export class Logger { constructor(_name: string) {} error(...values: unknown[]): void { context.log.error(...values); } }
export function getIntlMessage(name: string): string {
    const hashes: Record<string, string> = { SERVERS: '7hB4kg' };
    const messages = find(value => value?.[Symbol.toStringTag] === 'IntlMessagesProxy', 'message translations');
    const intl = find(value => typeof value?.string === 'function' && typeof value?.format === 'function', 'localization');
    return intl.string(messages[hashes[name]]);
}
export function subscribeFlux(handlers: Record<string, (event: any) => void>): void {
    const activation = context;
    void activation.webpack.waitFor<any>(value => typeof value?.dispatch === 'function' && typeof value?.subscribe === 'function' && typeof value?.unsubscribe === 'function')
        .then(dispatcher => {
            if (activation !== context || activation.signal.aborted) return;
            for (const [name, handler] of Object.entries(handlers)) {
                const callback = (event: any) => { if (activation === context && !activation.signal.aborted) handler(event); };
                dispatcher.subscribe(name, callback);
                subscriptions.add(() => dispatcher.unsubscribe(name, callback));
            }
        }).catch(error => { if (!activation.signal.aborted) activation.log.error(error); });
}
export function normalizePatches(definitions: any[]): SourcePatch[] {
    return definitions.map((patch, index) => ({
        id: ['guild-list', 'expanded-folders', 'folder-content', 'sidebar-layout', 'home-button'][index],
        find: patch.find.replace('#{intl::DISCODO_DISABLED}', 'Be8Q5E'),
        replacement: { match: /^[\s\S]*$/, replace(source: string): string {
            if (patch.predicate?.() === false) return source;
            for (const replacement of Array.isArray(patch.replacement) ? patch.replacement : [patch.replacement]) {
                if (replacement.predicate?.() === false) continue;
                const match = new RegExp(replacement.match.source.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)'), replacement.match.flags);
                if (!match.test(source)) throw new Error(`BetterFolders replacement did not match: ${replacement.match}`);
                match.lastIndex = 0;
                source = source.replace(match, typeof replacement.replace === 'string' ? replacement.replace.replaceAll('$self', '$self.plugin') :
                    (...args: any[]) => replacement.replace(...args).replaceAll('$self', '$self.plugin'));
            }
            return source;
        } }
    }));
}
