/* Copyright (c) 2022-2026 Vendicated and Bedrock contributors. SPDX-License-Identifier: GPL-3.0-or-later */
import type { ReactRuntime, RendererContext, SourcePatch } from '@bedrock/renderer';
let context: RendererContext;
export function setContext(ctx: RendererContext): void { context = ctx; }
function find(predicate: (value: any) => boolean, name: string): any {
    const value = context.webpack.find(predicate);
    if (!value) throw new Error(`Discord's ${name} is not available.`);
    return value;
}
function store(name: string): any {
    return new Proxy({}, { get(_target, key) {
        const value = find(value => value?.getName?.() === name, name), property = value[key];
        return typeof property === 'function' ? property.bind(value) : property;
    } });
}
export const React: ReactRuntime = new Proxy({} as ReactRuntime, { get(_target, key: keyof ReactRuntime) {
    if (key === 'Fragment') return context.react.Fragment;
    return (...args: unknown[]) => Reflect.apply(context.react[key] as Function, context.react, args);
} });
export const PresenceStore = store('PresenceStore'), SessionsStore = store('SessionsStore');
export const AuthenticationStore = store('AuthenticationStore'), UserStore = store('UserStore');
export const classes = (...values: any[]): string => values.filter(Boolean).join(' ');
export function Tooltip(props: any): any {
    return React.createElement(find(value => typeof value === 'function' && value.prototype?.shouldShowTooltip && value.prototype?.render, 'tooltip'), props);
}
let Boundary: any;
export function ErrorBoundary(props: any): any {
    const NativeReact = context.react as any;
    Boundary ||= class extends NativeReact.Component {
        state = { failed: false };
        static getDerivedStateFromError() { return { failed: true }; }
        componentDidCatch(error: unknown) { context.log.error(error); }
        render() { return this.state.failed ? null : this.props.children; }
    };
    return React.createElement(Boundary, props);
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
export function loadStyles(): void {
    const activation = context;
    void fetch(new URL('./styles.css', import.meta.url), { signal: activation.signal }).then(response => {
        if (!response.ok) throw new Error(`Could not load Platform Indicators styles (HTTP ${response.status}).`);
        return response.text();
    }).then(css => { if (activation === context && !activation.signal.aborted) activation.styles.add(css); })
        .catch(error => { if (!activation.signal.aborted) activation.log.error(error); });
}
const hashes: Record<string, string> = {
    GUILD_OWNER: 'pclUFJ', GUILD_COMMUNICATION_DISABLED_ICON_TOOLTIP_BODY: 'AeYyL+',
    GUILD_COMMUNICATION_DISABLED_BOTTOM_SHEET_TITLE: 'AmHag5', USER_PROFILE_PRONOUNS: 'GI2A8C'
};
function canonicalize(value: string, regex = false): string {
    return value.replace(/#\{intl::(\w+)\}/g, (_match, key: string) => {
        const hash = hashes[key];
        if (!hash) throw new Error(`Unknown translation key: ${key}`);
        const property = /^\d/.test(hash) || /[+/]/.test(hash) ? `["${hash}"]` : `.${hash}`;
        return regex ? property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : property;
    }).replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)');
}
export function normalizePatches(original: any[]): SourcePatch[] {
    const extra = [
        { find: '#{intl::GUILD_OWNER}),children:', replacement: { match: /children:\[(?=.{0,300},lostPermissionTooltipText:)/,
            replace: 'children:[$self.renderMembers(arguments[0]),' } },
        { find: 'PrivateChannel.renderAvatar', replacement: { match: /decorators:(\i\.isSystemDM\(\)\?.{0,100}:null)/,
            replace: 'decorators:[$self.renderMembers(arguments[0]),$1]' } },
        { find: '#{intl::GUILD_COMMUNICATION_DISABLED_ICON_TOOLTIP_BODY}', replacement: {
            match: /#{intl::GUILD_COMMUNICATION_DISABLED_BOTTOM_SHEET_TITLE}.+?renderPopout:.+?(?=\])/,
            replace: '$&,$self.renderMessages(arguments[0])' } },
        { find: '#{intl::USER_PROFILE_PRONOUNS}', replacement: [
            { match: /(?<=children:\i\}\):\i,)null!=\i/, replace: '($&||!!$self.renderNicknameIcons({userId:arguments[0].user?.id})?.length)' },
            { match: /(?<=shouldUnderlineOnHover:null.{0,300})children:(\i)(?=\}\)\])/,
                replace: 'children:[...$self.renderNicknameIcons({userId:arguments[0].user?.id}),$1]' }
        ] },
        { find: '.5625*', replacement: { match: /(?=}\s*$)/, replace: ';$self.captureColors(arguments[0].exports);' } }
    ];
    return [...original, ...extra].map((patch, index) => ({ id: ['mobile-mask', 'mobile-size', 'mobile-presence', 'member-icons', 'dm-icons', 'message-icons', 'profile-icons', 'status-colors'][index],
        find: canonicalize(patch.find), replacement: { match: /^[\s\S]*$/, replace(source: string): string {
            if (patch.predicate?.() === false) return source;
            for (const replacement of Array.isArray(patch.replacement) ? patch.replacement : [patch.replacement]) {
                const match = new RegExp(canonicalize(replacement.match.source, true), replacement.match.flags);
                if (!match.test(source)) throw new Error(`Platform Indicators replacement did not match: ${replacement.match}`);
                source = source.replace(match, replacement.replace);
            }
            return source;
        } }
    }));
}
