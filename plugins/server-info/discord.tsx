/* Copyright (c) 2023-2026 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { ReactRuntime, RendererContext } from '@bedrock/renderer';
let context: RendererContext;
const modals = new Map<string, () => void>();
let scrollerFactory: ((thin: string, fade: string, custom: string) => any) | undefined;
let Scroller: any;
export function setContext(ctx: RendererContext): void { context = ctx; }
export const getContext = () => context;
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
export const GuildChannelStore = store('GuildChannelStore'), GuildMemberStore = store('GuildMemberStore'), GuildRoleStore = store('GuildRoleStore'), GuildStore = store('GuildStore');
export const PresenceStore = store('PresenceStore'), RelationshipStore = store('RelationshipStore'), UserStore = store('UserStore');
export const FluxDispatcher = lazy(() => find(value => value?.dispatch && value?.subscribe && value?.wait, 'dispatcher'));
export const IconUtils = lazy(() => find(value => value?.getGuildBannerURL && value?.getUserAvatarURL, 'icon utilities'));
export const Parser = lazy(() => find(value => value?.parse && value?.parseTopic, 'message parser'));
export const UserUtils = { getUser(id: string): Promise<any> { return byCode('user fetch', '.USER(')(id); } };
export const SnowflakeUtils = lazy(() => find(value => value?.extractTimestamp && value?.fromTimestamp, 'snowflake utilities'));
export const React: ReactRuntime = new Proxy({} as ReactRuntime, { get(_target, key: keyof ReactRuntime) {
    if (key === 'Fragment') return context.react.Fragment;
    return (...args: unknown[]) => Reflect.apply(context.react[key] as Function, context.react, args);
} });
export const useEffect = React.useEffect;
export function useState<T>(): [T | undefined, (next: T | undefined | ((previous: T | undefined) => T | undefined)) => void];
export function useState<T>(initial: T): [T, (next: T | ((previous: T) => T)) => void];
export function useState<T>(initial?: T): any { return React.useState(initial); }
export const classes = (...values: any[]) => values.filter(Boolean).join(' ');
export const classNameFactory = (prefix: string) => (...values: any[]) => values.flatMap(value => typeof value === 'string' ? [value] : Object.keys(value).filter(key => value[key])).map(value => prefix + value).join(' ');
export function Heading({ tag = 'h5', className, children, ...props }: any): any { return React.createElement(tag, { ...props, className: classes('vc-' + tag, 'vc-' + tag + '-defaultMargin', className) }, children); }
export const Forms = { FormTitle: Heading, FormText: (props: any): any => React.createElement('p', { ...props, style: { fontFamily: 'var(--font-primary)', fontSize: '14px', fontWeight: 400, lineHeight: '1.28571', margin: 0, color: 'var(--text-default)' } }) };
export const getGuildAcronym = (guild: any) => guild.name.replaceAll("'s ", ' ').replace(/\w+/g, (match: string) => match[0]).replace(/\s/g, '');
export function findComponentByCodeLazy(...markers: string[]): any { return (props: any) => React.createElement(byCode(markers[0], ...markers), props); }
export function findCssClassesLazy(...names: string[]): any {
    return lazy(() => {
        const mapped = (value: any, name: string) => typeof value?.[name] === 'string' ? value[name] : Object.values(value || {}).find(item => typeof item === 'string' && item.split(' ').some(part => part.startsWith(name + '_')));
        const value = find(value => names.every(name => mapped(value, name)), names.join(', ') + ' styles');
        return Object.fromEntries(names.map(name => [name, mapped(value, name)]));
    });
}
export function setCreateScroller(factory: (thin: string, fade: string, custom: string) => any): void { scrollerFactory = factory; Scroller = undefined; }
export function ScrollerThin(props: any): any {
    if (!scrollerFactory) throw new Error("Discord's scroller factory has not loaded.");
    if (!Scroller) { const classes = findCssClassesLazy('thin', 'auto', 'fade', 'customTheme', 'none'); Scroller = scrollerFactory(classes.thin, classes.fade, classes.customTheme); }
    return React.createElement(Scroller, props);
}
export const Modal = (props: any): any => React.createElement(byCode('modal', 'leadingLayout:', 'actions:', '.message'), props);
export const TabBar = Object.assign((props: any): any => React.createElement(byCode('tabs', 'ref:this.tabBarRef,className:'), props), {
    Item: (props: any): any => React.createElement(byCode('tabs', 'ref:this.tabBarRef,className:').Item, props)
});
export const Timestamp = (props: any): any => React.createElement(byCode('timestamp', 'CDzOFd'), props);
let ModalBoundary: any;
export function openModal(render: (props: any) => any): void {
    if (context.signal.aborted) return;
    ModalBoundary ||= class extends (context.react as any).Component {
        state = { error: null as Error | null };
        static getDerivedStateFromError(error: Error) { return { error }; }
        componentDidCatch(error: unknown) { context.log.error('Could not display server info.', error); }
        render() { return this.state.error ? React.createElement(Modal, { ...this.props.modalProps, title: 'Server Info' }, React.createElement('p', null, this.state.error.message)) : this.props.children; }
    };
    const close = byCode('modal closer', '.onCloseCallback()');
    const key = byCode('modal opener', ',instant:')((props: any) => React.createElement(ModalBoundary, { modalProps: props }, render(props)), { onCloseCallback() { modals.delete(key); } });
    modals.set(key, () => close(key));
}
export function closeModals(): void { for (const close of modals.values()) close(); modals.clear(); }
export function openUserProfile(userId: string): void {
    if (context.signal.aborted) return;
    const guildId = context.webpack.find<any>(value => value?.getName?.() === 'SelectedGuildStore')?.getGuildId();
    byCode('user profile', 'type:"USER_PROFILE_MODAL_OPEN"')({ userId, guildId, sourceAnalyticsLocations: ['username', 'server info'] });
}
export function openImageModal(item: any): void {
    const activation = context;
    const predicate = (value: any) => typeof value === 'function' && String(value).includes('hasMediaOptions') && String(value).includes('shouldHideMediaOptions');
    void (async () => {
        if (!activation.webpack.find(predicate)) await activation.webpack.loadChunks({ find: ['hasMediaOptions', 'shouldHideMediaOptions'] });
        if (activation.signal.aborted) return;
        const open = activation.webpack.find<any>(predicate);
        if (!open) throw new Error("Discord's image viewer is not available.");
        open({ items: [{ type: 'IMAGE', original: item.original ?? item.url, ...item }] });
    })().catch(error => { if (!activation.signal.aborted) activation.log.error('Could not open the server image.', error); });
}
export function useStoreRevision(stores: any[]): number {
    const [revision, refresh] = React.useState(0);
    React.useEffect(() => {
        const update = () => refresh(value => value + 1);
        for (const store of stores) store.addChangeListener(update);
        return () => { for (const store of stores) store.removeChangeListener(update); };
    }, stores);
    return revision;
}
export function useStateFromStores(stores: any[], getValue: () => any, _dependencies?: any, _compare?: any): any { useStoreRevision(stores); return getValue(); }
export function useAwaiter(factory: () => Promise<any>, options: { deps: any[]; fallbackValue: any }): any[] {
    const [value, setValue] = React.useState(options.fallbackValue);
    React.useEffect(() => {
        let active = true;
        Promise.resolve().then(factory).then(value => { if (active && !context.signal.aborted) setValue(value); }).catch(error => { if (active && !context.signal.aborted) context.log.error('Could not load the server owner.', error); });
        return () => { active = false; };
    }, options.deps);
    return [value];
}
declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } interface IntrinsicAttributes { key?: string | number } } }
