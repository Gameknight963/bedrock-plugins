/* Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
let context: RendererContext | undefined;
let alternate = false;
let panel: { current: HTMLElement | null } | undefined;
export const settings = Bedrock.definePluginSettings({
    prioritizeServerProfile: { type: Bedrock.OptionType.BOOLEAN, label: 'Prefer server profile', description: 'Open your server profile when left-clicking the account panel', default: false }
});
const identifier = '(?:[A-Za-z_$][\\w$]*)';
export const patches: SourcePatch[] = [{ id: 'account-panel-profile', find: 'handleOpenSettingsContextMenu=', replacement: [
    { match: new RegExp(String.raw`(\.AVATAR,children:.+?renderPopout:\((\i),\i\)=>)\{(.+?)\}(?=,position)(?<=currentUser:(\i).+?)`.replaceAll('\\i', identifier)),
        replace: (_match: string, rest: string, popoutProps: string, originalPopout: string, currentUser: string) => `${rest}$self.UserProfile({popoutProps:${popoutProps},currentUser:${currentUser},originalRenderPopout:()=>{${originalPopout}}})` },
    { match: /\.AVATAR,children:.+?onRequestClose:\(\)=>\{/, replace: '$&$self.onPopoutClose();' },
    { match: new RegExp(String.raw`ref:(\i),style:\i(?=.{0,250}\["5fWB8U"\])`.replaceAll('\\i', identifier)), replace: '$&,onContextMenu:($self.grabRef($1),$self.openAccountPanelContextMenu)' }
] }];
function find(predicate: (value: any) => boolean, name: string): any {
    const value = context!.webpack.find(predicate);
    if (!value) throw new Error(`Discord's ${name} is not available.`);
    return value;
}
function currentChannel(): any {
    const selected = find(value => value?.getName?.() === 'SelectedChannelStore', 'selected channel store');
    return find(value => value?.getName?.() === 'ChannelStore', 'channel store').getChannel(selected.getChannelId());
}
export function AccountPanelContextMenu(): any {
    const ctx = context!;
    const { prioritizeServerProfile } = settings.use(['prioritizeServerProfile']);
    const Menu = find(value => value?.Menu && value?.MenuItem && value?.MenuCheckboxItem, 'menu components');
    const menus = find(value => value?.openContextMenu && value?.closeContextMenu, 'context menus');
    return ctx.react.createElement(Menu.Menu, { navId: 'bedrock-account-server-profile', onClose: menus.closeContextMenu },
        ctx.react.createElement(Menu.MenuItem, { id: 'view-alternate-profile', label: prioritizeServerProfile ? 'View Account Profile' : 'View Server Profile',
            disabled: !currentChannel()?.guild_id, action() { alternate = true; panel?.current?.click(); } }),
        ctx.react.createElement(Menu.MenuCheckboxItem, { id: 'prefer-server-profile', label: 'Prioritize Server Profile', checked: prioritizeServerProfile,
            action() { void settings.set('prioritizeServerProfile', !prioritizeServerProfile).catch(error => ctx.log.error('Could not save the profile preference.', error)); } }));
}
export function grabRef(ref: { current: HTMLElement | null }): typeof ref { panel = ref; return ref; }
export function onPopoutClose(): void { alternate = false; }
export function openAccountPanelContextMenu(event: MouseEvent): void {
    if (!context || context.signal.aborted) return;
    find(value => value?.openContextMenu && value?.closeContextMenu, 'context menus').openContextMenu(event, AccountPanelContextMenu);
}
export function UserProfile({ popoutProps, currentUser, originalRenderPopout }: any): any {
    if (!context || context.signal.aborted || settings.store.prioritizeServerProfile === alternate) return originalRenderPopout();
    try {
        const channel = currentChannel();
        if (!channel?.guild_id) return originalRenderPopout();
        const Profile = context.webpack.find(value => {
            const component = value?.type || value?.render || value;
            return typeof component === 'function' && String(component).includes('.isNonUserBot()?') && String(component).includes(',onClickContainer:');
        });
        if (!Profile) return originalRenderPopout();
        return context.react.createElement(Profile, { ...popoutProps, user: currentUser, currentUser, guildId: channel.guild_id, channelId: channel.id });
    } catch (error) { context.log.error('Could not open the server profile.', error); return originalRenderPopout(); }
}
export function start(ctx: RendererContext): void { context = ctx; alternate = false; }
export function stop(): void { context = undefined; alternate = false; panel = undefined; }
