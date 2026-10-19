/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, ReactRuntime } from '@bedrock/renderer';
let context: RendererContext;
export const setContext = (ctx: RendererContext) => { context = ctx; };
export const getContext = () => context;
function find(predicate: (value: any) => boolean, name: string): any {
    const value = context.webpack.find(predicate);
    if (!value) throw new Error(`Discord's ${name} is not available.`);
    return value;
}
function store(name: string): any {
    return new Proxy({}, { get(_target, key) {
        const target = find(value => value?.getName?.() === name, name), value = target[key];
        return typeof value === 'function' ? value.bind(target) : value;
    } });
}
export const TypingStore = store('TypingStore'), GuildMemberStore = store('GuildMemberStore'), RelationshipStore = store('RelationshipStore');
export const UserGuildSettingsStore = store('UserGuildSettingsStore'), SelectedChannelStore = store('SelectedChannelStore'), UserStore = store('UserStore');
export const React: ReactRuntime = new Proxy({} as ReactRuntime, { get(_target, key: keyof ReactRuntime) {
    if (key === 'Fragment') return context.react.Fragment;
    return (...args: unknown[]) => Reflect.apply(context.react[key] as Function, context.react, args);
} });
function byCode(name: string, ...markers: string[]): any {
    return find(value => { const component = value?.type || value?.render || value; return typeof component === 'function' && markers.every(marker => String(component).includes(marker)); }, name);
}
export const ThreeDots = (props: any): any => React.createElement(byCode('animated typing dots', 'Math.min(1,Math.max(', 'dotRadius:'), props);
export const UserSummaryItem = (props: any): any => React.createElement(byCode('user summary', 'defaultRenderUser', 'showDefaultAvatarsForNullUsers'), props);
export const Tooltip = (props: any): any => React.createElement(find(value => typeof value === 'function' && value.prototype?.shouldShowTooltip && value.prototype?.render, 'tooltip'), props);
export function useTypingTweaks(): any {
    const api = (globalThis as any).Bedrock;
    const tweaks = api._sourcePlugin?.('gameknight963.typing-tweaks');
    const [, refresh] = React.useState(0);
    React.useEffect(() => tweaks?.settings?.subscribe(() => refresh(value => value + 1)), [tweaks]);
    const record = api.plugins.list().find((plugin: any) => plugin.manifest.id === 'gameknight963.typing-tweaks');
    return record?.enabled && record.rendererStatus === 'running' ? tweaks : undefined;
}
const hashes: Record<string, string> = { ONE_USER_TYPING: 'lJ9sZX', TWO_USERS_TYPING: 'rB0CUa', THREE_USERS_TYPING: 'StKThj', SEVERAL_USERS_TYPING: 'uVDhqZ' };
export function getIntlMessage(name: string, args?: any): any {
    const messages = find(value => value?.[Symbol.toStringTag] === 'IntlMessagesProxy', 'message translations');
    const intl = find(value => typeof value?.format === 'function' && typeof value?.string === 'function', 'localization');
    return args ? intl.format(messages[hashes[name]], args) : intl.string(messages[hashes[name]]);
}
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
export function ErrorBoundary(props: any): any {
    Boundary ||= class extends (context.react as any).Component {
        state = { failed: false };
        static getDerivedStateFromError() { return { failed: true }; }
        componentDidCatch(error: unknown) { context.log.error('Could not display the typing indicator.', error); }
        render() { return this.state.failed ? null : this.props.children; }
    };
    return React.createElement(Boundary, props);
}
declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } interface IntrinsicAttributes { key?: string | number } } }
