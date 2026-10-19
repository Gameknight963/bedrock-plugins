/* Copyright (c) 2022-2026 Vendicated and Bedrock contributors. SPDX-License-Identifier: GPL-3.0-or-later */
import type { ReactRuntime, RendererContext, RendererSettingsContext, SourcePatch } from '@bedrock/renderer';
export { definePluginSettings, renderCustomSettings } from './settings.js';
export { BookCheckIcon, LinkIcon, OpenExternalIcon, PencilIcon, StarFilled, StarOutlined, TrashIcon, UnsendIcon, WindowTopOutlineIcon, XLargeBoldIcon } from './icons.js';
export type Channel = any;
export type Guild = any;
export type User = any;
export type Message = any;
export type Icon = any;
export type RenderModalProps = any;
export type NavContextMenuPatchCallback = (children: any[], props: any) => void;
declare global {
    namespace JSX { type Element = any; interface IntrinsicElements { [tag: string]: any } interface IntrinsicAttributes { key?: string | number } }
    namespace React {
        type ComponentType<Props = any> = (props: Props) => any;
        type PropsWithChildren<Props = any> = Props & { children?: any };
        type MouseEvent<T = any> = any;
        type CSSProperties = Record<string, any>;
    }
    interface Window { GLOBAL_ENV: { CDN_HOST: string; [key: string]: any } }
}
let activation: RendererContext;
let editor: RendererSettingsContext;
let colorPicker: any;
let extractedIcons: Record<string, any>;
const disposers = new Set<() => void>();
const modals = new Map<string, () => void>();
const storeWrites = new Map<string, Promise<unknown>>();
export function editorContext(ctx: RendererSettingsContext): void { editor = ctx; }
export function getContext(): RendererSettingsContext {
    const context = activation && !activation.signal.aborted ? activation : editor || activation;
    if (!context) throw new Error('Channel Tabs context is not initialized.');
    return context;
}
export const React: ReactRuntime = new Proxy({} as ReactRuntime, { get(_target, key: keyof ReactRuntime) {
    if (key === 'Fragment') return getContext().react.Fragment;
    return (...args: unknown[]) => Reflect.apply(getContext().react[key] as Function, getContext().react, args);
} });
type Setter<T> = (value: T | ((previous: T) => T)) => void;
export function useState<T>(initial: T | (() => T)): [T, Setter<T>];
export function useState<T = undefined>(): [T | undefined, Setter<T | undefined>];
export function useState(initial?: any): any { return React.useState(initial); }
export function useRef<T>(initial: T): { current: T };
export function useRef<T>(initial: T | null): { current: T | null };
export function useRef<T>(initial: T | null): { current: T | null } { return React.useRef(initial); }
export const useMemo = React.useMemo, useEffect = React.useEffect;
export const useCallback = React.useCallback, useLayoutEffect = React.useLayoutEffect;
export function find(predicate: (value: any) => boolean, name: string): any {
    const value = getContext().webpack.find(predicate);
    if (!value) throw new Error(`Discord's ${name} is not available.`);
    return value;
}
function lazy(factory: () => any): any {
    return new Proxy(function () {}, {
        get(_target, key) { const value = factory(), property = value[key]; return typeof property === 'function' ? property.bind(value) : property; },
        apply(_target, receiver, args) { return Reflect.apply(factory(), receiver, args); }
    });
}
const identifier = '(?:[A-Za-z_$][\\w$]*)';
function matchesCode(value: any, parts: (string | RegExp)[]): boolean {
    const component = value?.type || value?.render || value;
    return typeof component === 'function' && parts.every(part => typeof part === 'string' ? String(component).includes(part) : new RegExp(part.source.replaceAll('\\i', identifier), part.flags).test(String(component)));
}
export function findByCodeLazy<T = any>(...parts: (string | RegExp)[]): T { return lazy(() => find(value => matchesCode(value, parts), String(parts[0]))); }
export function findComponentByCodeLazy<T = any>(...parts: (string | RegExp)[]): any {
    return (props: T): any => React.createElement(find(value => matchesCode(value, parts), String(parts[0])), props as any);
}
export function findCssClassesLazy(...keys: string[]): any { return lazy(() => find(value => keys.every(key => typeof value?.[key] === 'string'), keys.join(', '))); }
const store = (name: string): any => lazy(() => find(value => value?.getName?.() === name, name));
export const ChannelStore = store('ChannelStore'), GuildStore = store('GuildStore'), UserStore = store('UserStore');
export const SelectedChannelStore = store('SelectedChannelStore'), SelectedGuildStore = store('SelectedGuildStore');
export const PresenceStore = store('PresenceStore'), TypingStore = store('TypingStore'), ReadStateStore = store('ReadStateStore');
export const ActiveJoinedThreadsStore = store('ActiveJoinedThreadsStore'), ChannelRTCStore = store('ChannelRTCStore');
export const FluxDispatcher = lazy(() => find(value => value?.dispatch && value?.subscribe && value?.wait, 'dispatcher'));
export const MessageActions = lazy(() => find(value => value?.editMessage && value?.sendMessage && value?.jumpToMessage, 'message actions'));
export const ContextMenuApi = lazy(() => find(value => value?.openContextMenu && value?.closeContextMenu, 'context menus'));
export const Menu = lazy(() => find(value => value?.Menu && value?.MenuItem && value?.MenuGroup, 'menu components'));
export const NavigationRouter = {
    transitionTo: findByCodeLazy('transitionTo -'), transitionToGuild: findByCodeLazy('transitionToGuild -'),
    back: findByCodeLazy('goBack()'), forward: findByCodeLazy('goForward()')
};
export const ReadStateUtils = { ackChannel: findByCodeLazy('.isForumLikeChannel(') };
export const useDrag = findByCodeLazy('useDrag::spec.begin was deprecated');
export const useDrop = findByCodeLazy('.disconnectDropTarget()', '.dropTargetOptions=');
export const Avatar = findComponentByCodeLazy('.size-1.375*');
export const TextInput = findComponentByCodeLazy('setHasValue?.(""!==', '="text",');
export const Select = findComponentByCodeLazy('selectionMode:"single",onSelectionChange:', 'isSelected:');
export const SearchableSelect = findComponentByCodeLazy('?"multiple":"single",required:');
export const Modal = findComponentByCodeLazy('leadingLayout:', 'actions:', '.message');
const Clickable = findComponentByCodeLazy('this.context?this.renderNonInteractive():');
export function Tooltip(props: any): any {
    return React.createElement(find(value => typeof value === 'function' && value.prototype?.shouldShowTooltip && value.prototype?.render, 'tooltip'), props);
}
export function ColorPicker(props: any): any {
    const [error, setError] = useState('');
    const [, refresh] = useState(0);
    const ctx = getContext();
    useEffect(() => {
        let mounted = true;
        if (!colorPicker) void ctx.webpack.loadChunks({ find: 'type:"USER_SETTINGS_MODAL_OPEN"' }).then(() => {
            if (mounted && !ctx.signal.aborted) refresh(value => value + 1);
        }).catch(error => { if (mounted && !ctx.signal.aborted) setError(error.message); });
        return () => { mounted = false; };
    }, [ctx]);
    return colorPicker ? React.createElement(colorPicker, props) : <p role={error ? 'alert' : 'status'}>{error || 'Loading color picker...'}</p>;
}
export function captureColorPicker(component: any): void { colorPicker = component; }
export function setIconsModule(value: Record<string, any>): void { extractedIcons = value; }
export const iconsModule = new Proxy({}, {
    get(_target, key) { return Reflect.get(extractedIcons || find(value => value?.AngleBracketsIcon && value?.AIcon, 'named icons'), key); },
    ownKeys() { return Object.keys(extractedIcons || find(value => value?.AngleBracketsIcon && value?.AIcon, 'named icons')); },
    getOwnPropertyDescriptor() { return { enumerable: true, configurable: true }; }
});
export function classes(...names: any[]): string { return names.filter(Boolean).join(' '); }
export function classNameFactory(prefix: string): (...names: any[]) => string {
    return (...names) => names.flatMap(name => !name ? [] : typeof name === 'string' ? [prefix + name] : Object.entries(name).filter(([, value]) => value).map(([key]) => prefix + key)).join(' ');
}
export const IS_MAC = false;
export const Margins = { top8: 'bedrock-ct-top8', top16: 'bedrock-ct-top16', bottom8: 'bedrock-ct-bottom8' };
export const OptionType = { ...Bedrock.OptionType, COMPONENT: 'component' };
export const makeRange = (min: number, max: number, step = 1): number[] => Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, index) => min + index * step);
export function getGuildAcronym(guild: any): string { return guild.name.replaceAll("'s ", ' ').replace(/\w+/g, (word: string) => word[0]).replace(/\s/g, ''); }
const hashes: Record<string, string> = {
    CHANNEL_CHAT_HEADING: 'eTzKkx', CHANNEL_MESSAGES_A11Y_LABEL: 'XarRiL', MARK_AS_READ: 'e6RscS', UNKNOWN_CHANNEL: 'zLZPmk',
    CHANNELS_AND_ROLES: 'h9mGOP', GUILD_SIDEBAR_CHANNEL_BROWSER: 'ci7216', GUILD_SHOP_CHANNEL_LABEL: 'al5EXL',
    MEMBER_SAFETY_CHANNEL_TITLE: 'oclz3Z', SERVER_GUIDE: 'VbpLyU', GROUP_DM: 'e5y+gm', FRIENDS: 'TdEu5X'
};
export function getIntlMessage(key: string): string {
    const messages = find(value => value?.[Symbol.toStringTag] === 'IntlMessagesProxy', 'message translations');
    return find(value => typeof value?.string === 'function' && typeof value?.format === 'function', 'localization').string(messages[hashes[key]]);
}
export class Logger {
    constructor(_name: string) {}
    error(...values: any[]) { console.error('[Bedrock:gameknight963.channel-tabs]', ...values); }
    warn(...values: any[]) { console.warn('[Bedrock:gameknight963.channel-tabs]', ...values); }
    info(...values: any[]) { console.info('[Bedrock:gameknight963.channel-tabs]', ...values); }
}
export function isPluginEnabled(name: string): boolean { return (globalThis as any).Bedrock.plugins.list().some((plugin: any) => plugin.enabled && plugin.manifest.name.replaceAll(' ', '') === name); }
export function showToast(message: string, kind?: string): void { activation?.notifications.show({ title: message, type: kind === 'failure' ? 'error' : 'info' }); }
let Boundary: any;
export const ErrorBoundary = Object.assign((props: any): any => {
    const NativeReact = getContext().react as any;
    Boundary ||= class extends NativeReact.Component {
        state = { error: null };
        static getDerivedStateFromError(error: any) { return { error: String(error.message || error) }; }
        componentDidCatch(error: any) { new Logger('ChannelTabs').error(error); }
        render() { return this.state.error ? this.props.noop ? null : <p role="alert" className="bedrock-error">{this.state.error}</p> : this.props.children; }
    };
    return React.createElement(Boundary, props);
}, { wrap(component: any, options?: any): any { return (props: any) => React.createElement(ErrorBoundary, options, React.createElement(component, props)); } });
export function useStateFromStores<T>(stores: any[], getValue: () => T): T {
    const [, refresh] = useState(0);
    useEffect(() => {
        const update = () => refresh(value => value + 1);
        for (const store of stores) store.addChangeListener(update);
        update();
        return () => { for (const store of stores) store.removeChangeListener(update); };
    }, stores);
    return getValue();
}
export function useForceUpdater(): () => void { const [, refresh] = useState(0); return useCallback(() => refresh(value => value + 1), []); }
export function useAwaiter<T>(factory: () => Promise<T>, options: any = {}): [T, unknown, boolean] {
    const [state, setState] = useState({ value: options.fallbackValue, error: null, pending: true });
    useEffect(() => {
        let mounted = true;
        void factory().then(value => { if (mounted) { setState({ value, error: null, pending: false }); options.onSuccess?.(value); } })
            .catch(error => { if (mounted) { setState({ value: options.fallbackValue, error, pending: false }); options.onError?.(error); } });
        return () => { mounted = false; };
    }, options.deps || []);
    return [state.value, state.error, state.pending];
}
export function openModal(render: (props: any) => any): string {
    const open = findByCodeLazy(',instant:'), close = findByCodeLazy('.onCloseCallback()');
    const key = open((props: any) => React.createElement(ErrorBoundary, null, render(props)), { onCloseCallback() { modals.delete(key); } });
    modals.set(key, () => close(key));
    return key;
}
export function closeModal(key: string): void { modals.get(key)?.(); modals.delete(key); }
export function findGroupChildrenByChildId(id: string, children: any[]): any[] | undefined {
    if (children.some(child => child?.props?.id === id)) return children;
    for (const child of children) { const nested = child?.props?.children; if (Array.isArray(nested)) { const group = findGroupChildrenByChildId(id, nested); if (group) return group; } }
}
export const DataStore = {
    async get<T = any>(key: string): Promise<T> { await storeWrites.get(key)?.catch(() => {}); return getContext().settings.get<any>('store.' + key, undefined); },
    set<T = any>(key: string, value: T): Promise<void> { return this.update(key, () => value); },
    update<T = any>(key: string, change: (value: T) => T): Promise<void> {
        const ctx = getContext();
        const work = (storeWrites.get(key) || Promise.resolve()).catch(() => {}).then(async () => {
            if (ctx.signal.aborted) return;
            await ctx.settings.set('store.' + key, change(ctx.settings.get<any>('store.' + key, undefined)));
        });
        storeWrites.set(key, work);
        return work;
    }
};
// Forward refs without resolving Discord's React before the module loads.
export const Button: any = {
    $$typeof: Symbol.for('react.forward_ref'),
    render({ children, className = '', variant = 'primary', color, size = 'medium', look, ...props }: any, ref: any) {
        const colors: Record<string, string> = { RED: 'dangerPrimary', PRIMARY: 'secondary', TRANSPARENT: 'none', BRAND: 'primary' };
        return <button ref={ref} type="button" data-mana-component="button" className={`vc-btn-base vc-btn-${colors[color] || variant} vc-btn-${size} ${className}`} {...props}>{children}</button>;
    },
    Colors: { BRAND: 'BRAND', PRIMARY: 'PRIMARY', RED: 'RED', TRANSPARENT: 'TRANSPARENT' },
    Sizes: { SMALL: 'small', MEDIUM: 'medium' }, Looks: { FILLED: '' }
};
export function Flex({ children, flexDirection, gap = '1em', style, ...props }: any): any { return <div {...props} style={{ display: 'flex', flexDirection, gap, ...style }}>{children}</div>; }
export function Heading({ children, tag = 'h5', ...props }: any): any { return React.createElement(tag, { className: `vc-${tag} vc-${tag}-defaultMargin`, ...props }, children); }
export function BaseText({ children, tag = 'span', size = 'sm', weight = 'normal', color = 'text-default', className = '', ...props }: any): any {
    const sizes: Record<string, number> = { xs: 12, sm: 14, md: 16, lg: 20 };
    const weights: Record<string, number> = { normal: 400, medium: 500, semibold: 600, bold: 700 };
    return React.createElement(tag, { ...props, className: `vc-text-base ${className}`, style: { fontSize: sizes[size], fontWeight: weights[weight], color: `var(--${color})`, ...props.style } }, children);
}
export const Text = BaseText;
export const Paragraph = (props: any): any => <BaseText tag="p" {...props} />;
export const Divider = (): any => <hr className="bedrock-ct-divider" />;
export function loadStyles(ctx: RendererSettingsContext): void {
    void Promise.all(['style.css', 'controls.css'].map(async file => {
        const response = await fetch(new URL(file, import.meta.url), { signal: ctx.signal });
        if (!response.ok) throw new Error(`Could not load Channel Tabs ${file} (HTTP ${response.status}).`);
        return response.text();
    })).then(sources => { if (!ctx.signal.aborted) ctx.styles.add(sources.join('\n')); }).catch(error => { if (!ctx.signal.aborted) ctx.log.error(error); });
}
export function startContext(ctx: RendererContext, handlers: Record<string, (event: any) => void>): void {
    activation = ctx;
    loadStyles(ctx);
    void ctx.webpack.waitFor<any>(value => value?.dispatch && value?.subscribe && value?.unsubscribe).then(dispatcher => {
        if (ctx.signal.aborted) return;
        for (const [name, handler] of Object.entries(handlers)) {
            const callback = (event: any) => { if (!ctx.signal.aborted) handler(event); };
            dispatcher.subscribe(name, callback); disposers.add(() => dispatcher.unsubscribe(name, callback));
        }
    }).catch(error => { if (!ctx.signal.aborted) ctx.log.error(error); });
}
export function stopContext(): void {
    for (const dispose of disposers) dispose(); disposers.clear();
    for (const close of modals.values()) close(); modals.clear();
}
function canonicalize(source: string, regex = false): string {
    return source.replace(/#\{intl::(\w+)\}/g, (_match, key) => {
        const property = '.' + hashes[key];
        if (!hashes[key]) throw new Error(`Unknown translation key: ${key}`);
        return regex ? property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : property;
    }).replaceAll('\\i', identifier);
}
export function normalizePatches(original: any[]): SourcePatch[] {
    return [...original,
        { find: 'AngleBracketsIcon', replacement: { match: /\i\.\i\((\i)\),\i\.\i\(\i,\{AIcon/, replace: '$self.setIconsModule($1),$&' } },
        { find: '.Qp04hK}),focusProps:', replacement: { match: /(?=function (\i)\(\i\)\{let\{onChange:\i,onClose:\i,[^}]+?showEyeDropper:)/, replace: '$self.captureColorPicker($1);' } }
    ].map((patch, index) => ({ id: ['tabs-container', 'navigation', 'mentions', 'search-results', 'main-chat', 'scroll-state', 'folder-icons', 'color-picker'][index],
        find: canonicalize(patch.find), replacement: { match: /^[\s\S]*$/, replace(source: string): string {
            for (const replacement of Array.isArray(patch.replacement) ? patch.replacement : [patch.replacement]) {
                if (replacement.predicate?.() === false) continue;
                const match = new RegExp(canonicalize(replacement.match.source, true), replacement.match.flags);
                if (!match.test(source)) throw new Error(`Channel Tabs replacement did not match: ${replacement.match}`);
                const replace = replacement.replace.replaceAll('$self', index < original.length ? '$self.plugin' : '$self');
                source = source.replace(match, replace);
            }
            return source;
        } }
    }));
}
