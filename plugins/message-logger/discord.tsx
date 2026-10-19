/* Copyright (c) 2022-2026 Vendicated and Bedrock contributors. SPDX-License-Identifier: GPL-3.0-or-later */
import type { Disposer, ReactRuntime, RendererContext, SourcePatch } from '@bedrock/renderer';

export interface MessageAttachment { id: string; deleted?: boolean; [key: string]: any }
export interface Message {
    id: string; channel_id: string; content: string; timestamp: Date; author: any;
    attachments: MessageAttachment[]; [key: string]: any;
}
export type RenderModalProps = Record<string, any>;
export type NavContextMenuPatchCallback = (children: any[], props: any) => void;
let context: RendererContext;
const modals = new Map<string, () => void>();
const styles = new Map<string, Disposer>();
let deleteStyle = 'text';
let styleSources: string[] = [];
export function setContext(ctx: RendererContext): void { context = ctx; styleSources = []; }
export function scheduleUpdate(callback: () => void): void {
    const activation = context;
    queueMicrotask(() => { if (activation === context && !activation.signal.aborted) callback(); });
}
export function stopContext(): void {
    for (const close of modals.values()) close();
    modals.clear();
    for (const dispose of styles.values()) dispose();
    styles.clear();
    styleSources = [];
}
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
export const useState = <T,>(initial: T) => React.useState(initial);
const store = (name: string): any => lazy(() => find(value => value?.getName?.() === name, name));
export const MessageStore = store('MessageStore'), ChannelStore = store('ChannelStore'), UserStore = store('UserStore');
export const SelectedChannelStore = store('SelectedChannelStore'), AuthenticationStore = store('AuthenticationStore');
export const FluxDispatcher = lazy(() => find(value => value?.dispatch && value?.subscribe && value?.wait, 'dispatcher'));
export const Parser = lazy(() => find(value => value?.parse && value?.parseTopic, 'message parser'));
export const Menu = lazy(() => find(value => value?.Menu && value?.MenuItem && value?.MenuGroup, 'menu components'));
export const Timestamp = (props: any): any => React.createElement(byCode('timestamp', 'CDzOFd'), props);
export const Modal = (props: any): any => React.createElement(byCode('modal', 'leadingLayout:', 'actions:', '.message'), props);
export const TabBar = Object.assign((props: any): any => React.createElement(byCode('tabs', 'ref:this.tabBarRef,className:'), props), {
    Item: (props: any): any => React.createElement(byCode('tabs', 'ref:this.tabBarRef,className:').Item, props)
});
export function openModal(render: (props: any) => any): void {
    if (context.signal.aborted) return;
    const open = byCode('modal opener', ',instant:');
    const close = byCode('modal closer', '.onCloseCallback()');
    const key = open(render, { onCloseCallback() { modals.delete(key); } });
    modals.set(key, () => close(key));
}
export const classes = (...values: any[]): string => values.filter(Boolean).join(' ');
export const classNameFactory = (prefix: string) => (...values: string[]) => values.map(value => prefix + value).join(' ');
export const Margins = { top20: 'bedrock-ml-top20' };
export function findCssClassesLazy(...props: string[]): any { return lazy(() => find(value => props.every(prop => typeof value?.[prop] === 'string'), props.join(', '))); }
export function getIntlMessage(name: string): string {
    const hashes: Record<string, string> = { MESSAGE_EDITED: 'C8sXIM' };
    const messages = find(value => value?.[Symbol.toStringTag] === 'IntlMessagesProxy', 'message translations');
    return find(value => typeof value?.string === 'function' && typeof value?.format === 'function', 'localization').string(messages[hashes[name]]);
}
export class Logger { constructor(_name: string) {} error(...values: unknown[]): void { context.log.error(...values); } }
export function useStateFromStores(stores: any[], getValue: () => any, _dependencies?: any, _compare?: any): any {
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
export const ErrorBoundary = Object.assign((props: any): any => {
    const NativeReact = context.react as any;
    Boundary ||= class extends NativeReact.Component {
        state = { failed: false };
        static getDerivedStateFromError() { return { failed: true }; }
        componentDidCatch(error: unknown) { context.log.error(error); }
        render() { return this.state.failed ? null : this.props.children; }
    };
    return React.createElement(Boundary, props);
}, { wrap(component: any, _options?: unknown): any {
    return (props: any) => React.createElement(ErrorBoundary, null, React.createElement(component, props));
} });
export function TooltipContainer({ children, ...props }: any): any {
    const Tooltip = find(value => typeof value === 'function' && value.prototype?.shouldShowTooltip && value.prototype?.render, 'tooltip');
    return React.createElement(Tooltip, { ...props, children: (tooltipProps: any) => React.createElement('div', tooltipProps, children) });
}
export function FormSwitch({ title, value, onChange }: any): any {
    const [focusVisible, setFocusVisible] = React.useState(false);
    const focus = (event: any) => setFocusVisible(event.currentTarget.matches(':focus-visible'));
    return <div className="vc-form-switch-container"><label className="vc-form-switch">
        <span className="vc-form-switch-text">{title}</span><span className="vc-form-switch-control">
            <span className={classes('vc-switch-container', value && 'vc-switch-checked', focusVisible && 'vc-switch-focusVisible')}>
                <span className="vc-switch-indicator" data-mana-component="switch">
                    <svg className="vc-switch-thumb" viewBox="0 0 24 24" preserveAspectRatio="xMidYMin meet" aria-hidden="true">
                        <rect fill="var(--switch-thumb-background-default)" x="4" y="4" width="16" height="16" rx="8" />
                    </svg>
                </span>
                <input type="checkbox" role="switch" className="vc-switch-input" checked={value}
                    onChange={(event: any) => onChange(event.currentTarget.checked)} onFocus={focus} onBlur={focus} />
            </span>
        </span>
    </label></div>;
}
export function DeleteIcon(props: any): any {
    return <svg width="24" height="24" viewBox="0 0 24 24" {...props}>
        <path fill="currentColor" d="M15 3.999V2H9V3.999H3V5.999H21V3.999H15Z" />
        <path fill="currentColor" d="M5 6.99902V18.999C5 20.101 5.897 20.999 7 20.999H17C18.103 20.999 19 20.101 19 18.999V6.99902H5ZM11 17H9V11H11V17ZM15 17H13V11H15V17Z" />
    </svg>;
}
// Eye icon by CorellanStoma: https://github.com/CreArts-Community/Settings-Icons
export function EyeIcon(props: any): any {
    return <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M15.56 11.77c.2-.1.44.02.44.23a4 4 0 1 1-4-4c.21 0 .33.25.23.44a2.5 2.5 0 0 0 3.32 3.32Z" />
        <path fillRule="evenodd" clipRule="evenodd" d="M22.89 11.7c.07.2.07.4 0 .6C22.27 13.9 19.1 21 12 21c-7.11 0-10.27-7.11-10.89-8.7a.83.83 0 0 1 0-.6C1.73 10.1 4.9 3 12 3c7.11 0 10.27 7.11 10.89 8.7Zm-4.5-3.62A15.11 15.11 0 0 1 20.85 12c-.38.88-1.18 2.47-2.46 3.92C16.87 17.62 14.8 19 12 19c-2.8 0-4.87-1.38-6.39-3.08A15.11 15.11 0 0 1 3.15 12c.38-.88 1.18-2.47 2.46-3.92C7.13 6.38 9.2 5 12 5c2.8 0 4.87 1.38 6.39 3.08Z" />
    </svg>;
}
export function findGroupChildrenByChildId(id: string, children: any[]): any[] | undefined {
    if (children.some(child => child?.props?.id === id)) return children;
    for (const child of children) {
        const nested = child?.props?.children;
        if (Array.isArray(nested)) {
            const group = findGroupChildrenByChildId(id, nested);
            if (group) return group;
        }
    }
}
export function updateMessage(channelId: string, messageId: string, fields?: Record<string, any>): void {
    if (context.signal.aborted) return;
    const cache = find(value => value?.getOrCreate && value?.commit && value?._channelMessages, 'message cache');
    const messages = cache.getOrCreate(channelId);
    if (!messages.has(messageId)) return;
    cache.commit(messages.update(messageId, (old: any) => fields ? old.merge(fields) : new old.constructor(old)));
    MessageStore.emitChange();
}
export function loadStyles(): void {
    const activation = context;
    void Promise.all(['messageLogger.css', 'controls.css', 'deleteStyleText.css', 'deleteStyleOverlay.css'].map(async filename => {
        const response = await fetch(new URL(filename, import.meta.url), { signal: activation.signal });
        if (!response.ok) throw new Error(`Could not load Message Logger's ${filename} (HTTP ${response.status}).`);
        return response.text();
    })).then(sources => {
        if (activation !== context || activation.signal.aborted) return;
        styleSources = sources;
        styles.set('base', activation.styles.add(sources[0] + '\n' + sources[1]));
        setDeleteStyle(deleteStyle);
    }).catch(error => { if (!activation.signal.aborted) activation.log.error(error); });
}
export function setDeleteStyle(value: string): void {
    deleteStyle = value;
    styles.get('deleted')?.();
    styles.delete('deleted');
    if (styleSources.length && !context.signal.aborted) styles.set('deleted', context.styles.add(styleSources[value === 'text' ? 2 : 3]));
}
export function normalizePatches(definitions: any[]): SourcePatch[] {
    const hashes: Record<string, string> = { REMOVE_ATTACHMENT_TOOLTIP_TEXT: '/XT3ij', MESSAGE_EDITED: 'C8sXIM', NEW_MESSAGES_ESTIMATED_WITH_DATE: 'tHqbtg' };
    return definitions.map((patch, index) => ({ id: `message-logger-${index}`, find: patch.find.replace(/#\{intl::(\w+)\}/g, (_match: string, name: string) => hashes[name]),
        replacement: { match: /^[\s\S]*$/, replace(source: string): string {
            if (patch.predicate?.() === false) return source;
            for (const replacement of Array.isArray(patch.replacement) ? patch.replacement : [patch.replacement]) {
                if (replacement.predicate?.() === false) continue;
                const match = new RegExp(replacement.match.source.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)'), replacement.match.flags);
                if (!match.test(source)) throw new Error(`Message Logger replacement did not match: ${replacement.match}`);
                source = source.replace(match, replacement.replace.replaceAll('$self', '$self.plugin'));
            }
            return source;
        } }
    }));
}
