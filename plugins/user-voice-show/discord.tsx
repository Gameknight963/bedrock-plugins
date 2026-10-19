/* Copyright (c) 2023-2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { ReactRuntime, RendererContext } from '@bedrock/renderer';
let context: RendererContext;
export function setContext(ctx: RendererContext): void { context = ctx; }
export function getContext(): RendererContext { return context; }
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
function byCode(name: string, ...markers: string[]): any {
    return find(value => { const component = value?.type || value?.render || value; return typeof component === 'function' && markers.every(marker => String(component).includes(marker)); }, name);
}
function store(name: string): any { return lazy(() => find(value => value?.getName?.() === name, name)); }
export const VoiceStateStore = store('VoiceStateStore'), ChannelStore = store('ChannelStore'), UserStore = store('UserStore'), PermissionStore = store('PermissionStore');
export const PermissionsBits = { VIEW_CHANNEL: 1024n, CONNECT: 1048576n };
export const React: ReactRuntime = new Proxy({} as ReactRuntime, { get(_target, key: keyof ReactRuntime) {
    if (key === 'Fragment') return context.react.Fragment;
    return (...args: unknown[]) => Reflect.apply(context.react[key] as Function, context.react, args);
} });
export const useMemo = React.useMemo;
export const Parser = lazy(() => find(value => value?.parse && value?.parseTopic, 'message parser'));
export const ChannelRouter = { transitionToChannel(id: string) { byCode('channel router', '.openTextInVoiceIfVoiceChannel')(id); } };
export function selectVoiceChannel(id: string): void { find(value => value?.selectVoiceChannel && value?.selectChannel, 'voice channel actions').selectVoiceChannel(id); }
export const classes = (...values: any[]) => values.filter(Boolean).join(' ');
export const classNameFactory = (prefix: string) => (...values: any[]) => values.filter(Boolean).map(value => prefix + value).join(' ');
export const isPluginEnabled = (name: string) => (globalThis as any).Bedrock.plugins.list().some((plugin: any) => plugin.enabled && plugin.manifest.name.replaceAll(' ', '') === name);
export const ShowHiddenChannelsPlugin = { name: 'ShowHiddenChannels' };
export const ActionButtonClasses = lazy(() => find(value => typeof value?.actionButton === 'string' && typeof value?.highlight === 'string', 'friend action button styles'));
export function Tooltip(props: any): any {
    return React.createElement(find(value => typeof value === 'function' && value.prototype?.shouldShowTooltip && value.prototype?.render, 'tooltip'), props);
}
export function UserSummaryItem(props: any): any { return React.createElement(byCode('user summary', 'defaultRenderUser', 'showDefaultAvatarsForNullUsers'), props); }
export function BaseText(props: any): any { return React.createElement('span', { style: { fontSize: '12px', lineHeight: '16px', fontWeight: props.weight === 'bold' ? 600 : 400 } }, props.children); }
export function showToast(message: string, type: string): void {
    const show = byCode('toast', '.currentToastMap.has(');
    const create = context.webpack.find<any>(value => typeof value === 'function' && String(value).includes('variant:"default",icon:') && String(value).includes('.duration'));
    show(create ? create(message, type) : { text: message, variant: type });
}
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
let Boundary: any;
export const ErrorBoundary = { wrap(component: any, _options: any): any {
    return (props: any) => {
        if (!context || context.signal.aborted) return null;
        Boundary ||= class extends (context.react as any).Component {
            state = { failed: false };
            static getDerivedStateFromError() { return { failed: true }; }
            componentDidCatch(error: unknown) { context.log.error('Could not display the voice indicator.', error); }
            render() { return this.state.failed ? null : this.props.children; }
        };
        return React.createElement(Boundary, null, React.createElement(component, props));
    };
} };
declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } interface IntrinsicAttributes { key?: string | number } } }
