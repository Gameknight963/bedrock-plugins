/* Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
let context: RendererContext;
export const settings = Bedrock.definePluginSettings({
    showAtSymbol: { type: Bedrock.OptionType.BOOLEAN, label: 'Show @ symbol', description: 'Show the @ symbol in user mentions', default: true }
});
const identifier = '(?:[A-Za-z_$][\\w$]*)';
export const patches: SourcePatch[] = [
    { id: 'user-mention-avatar', find: '.USER_MENTION)', replacement: {
        match: new RegExp(String.raw`children:\x60@\$\{(\i\?\?\i)\}\x60(?<=\.useName\((\i)\).+?)`.replaceAll('\\i', identifier)),
        replace: "children:$self.renderUsername({username:$1,user:$2,showMeYourNameMention:typeof showMeYourNameMention!=='undefined'?showMeYourNameMention:undefined})"
    } },
    { id: 'role-mention-icon', find: '.ROLE_MENTION)', replacement: {
        match: new RegExp(String.raw`children:\[\i&&.{0,100}className:\i.\i,background:!1,.{0,50}?,\i(?=\])`.replaceAll('\\i', identifier)),
        replace: '$&,$self.renderRoleIcon(arguments[0])'
    } },
    { id: 'input-mention-avatar', find: '"text":"locked"', replacement: {
        match: new RegExp(String.raw`(?<=,(\i)\).{0,55})\x60@\$\{(\i)\}\x60`.replaceAll('\\i', identifier)),
        replace: '$self.renderInputMention($2,$1)'
    } }
];
function store(name: string): any {
    const value = context.webpack.find<any>(value => value?.getName?.() === name);
    if (!value) throw new Error(`Discord's ${name} is not available.`);
    return value;
}
const usernameString = (username: string) => settings.store.showAtSymbol ? `@${username}` : username;
function Username({ user, username, showMeYourNameMention }: any): any {
    settings.use(['showAtSymbol']);
    const [isHovering, setIsHovering] = context.react.useState(false);
    return context.react.createElement('span', { onMouseEnter: () => setIsHovering(true), onMouseLeave: () => setIsHovering(false), className: 'vc-mentionAvatars-container' },
        user ? context.react.createElement('img', { src: user.getAvatarURL(store('SelectedGuildStore').getGuildId(), 16, isHovering), alt: '', className: 'vc-mentionAvatars-icon', style: { borderRadius: '50%' } }) : null,
        showMeYourNameMention ?? usernameString(username));
}
function InputMention({ username, user }: any): any {
    settings.use(['showAtSymbol']);
    return context.react.createElement(context.react.Fragment, null,
        user ? context.react.createElement('img', { src: user.getAvatarURL(store('SelectedGuildStore').getGuildId(), 16), alt: '', className: 'vc-mentionAvatars-icon', style: { borderRadius: '50%' } }) : null,
        usernameString(username));
}
const rolePaths = [
    'M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.794 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.711 13.006 18 15.473 18 19.006V20.006H2V19.006Z',
    'M20.0001 20.006H22.0001V19.006C22.0001 16.4433 20.2697 14.4415 17.5213 13.5352C19.0621 14.9127 20.0001 16.8059 20.0001 19.006V20.006Z',
    'M14.8834 11.9077C16.6657 11.5044 18.0001 9.9077 18.0001 8.00598C18.0001 5.96916 16.4693 4.28218 14.4971 4.0367C15.4322 5.09511 16.0001 6.48524 16.0001 8.00598C16.0001 9.44888 15.4889 10.7742 14.6378 11.8102C14.7203 11.8418 14.8022 11.8743 14.8834 11.9077Z'
];
function RoleIcon({ roleId, guildId }: any): any {
    const roles = store('GuildRoleStore');
    const [, refresh] = context.react.useState(0);
    context.react.useEffect(() => {
        const update = () => refresh(value => value + 1);
        roles.addChangeListener(update);
        return () => roles.removeChangeListener(update);
    }, [roles]);
    if (!roleId) return null;
    const role = roles.getRole(guildId, roleId);
    if (role?.icon) return context.react.createElement('img', { className: 'vc-mentionAvatars-icon vc-mentionAvatars-role-icon', alt: '',
        src: `${location.protocol}//${(globalThis as any).GLOBAL_ENV.CDN_HOST}/role-icons/${roleId}/${role.icon}.webp?size=24&quality=lossless` });
    return context.react.createElement('svg', { className: 'vc-mentionAvatars-icon vc-mentionAvatars-role-icon', xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', fill: 'currentColor' },
        ...rolePaths.map((d, index) => context.react.createElement('path', { key: index, d })));
}
let Boundary: any;
function guarded(component: any, props: any, fallback: any): any {
    if (!context || context.signal.aborted) return fallback;
    Boundary ||= class extends (context.react as any).Component {
        state = { failed: false };
        static getDerivedStateFromError() { return { failed: true }; }
        componentDidCatch(error: unknown) { context.log.error('Could not display the mention avatar.', error); }
        render() { return this.state.failed ? this.props.fallback : this.props.children; }
    };
    return context.react.createElement(Boundary, { fallback }, context.react.createElement(component, props));
}
export const renderUsername = (props: any) => guarded(Username, props, usernameString(props.username));
export const renderInputMention = (username: string, user: any) => guarded(InputMention, { username, user }, usernameString(username));
export const renderRoleIcon = (props: any) => guarded(RoleIcon, props, null);
export async function start(ctx: RendererContext): Promise<void> {
    context = ctx;
    const response = await fetch(new URL('./styles.css', import.meta.url), { signal: ctx.signal });
    if (!response.ok) throw new Error(`Could not load mention avatar styles (HTTP ${response.status}).`);
    const css = await response.text();
    if (!ctx.signal.aborted) ctx.styles.add(css);
}
