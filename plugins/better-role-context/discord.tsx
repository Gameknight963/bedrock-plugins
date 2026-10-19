/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { ReactRuntime, RendererContext } from '@bedrock/renderer';
let context: RendererContext | undefined;
let developerMode: { getSetting(): boolean; updateSetting(value: boolean): Promise<void> } | undefined;
let memberPopout: unknown;
let ownsContextMenu = false;
const popouts = new Set<() => void>();
export function setContext(ctx: RendererContext): void { context = ctx; }
export function isActive(activation = context): boolean { return !!activation && activation === context && !activation.signal.aborted; }
export function stopContext(): void {
    for (const close of popouts) close();
    popouts.clear();
    if (ownsContextMenu) ContextMenuApi.closeContextMenu();
    ownsContextMenu = false; context = undefined;
}
function ctx(): RendererContext { if (!context) throw new Error('Better Role Context is disabled.'); return context; }
function find(predicate: (value: any) => boolean, name: string): any {
    const result = ctx().webpack.find(predicate);
    if (!result) throw new Error(`Discord's ${name} is not available.`);
    return result;
}
function lazy(factory: () => any): any {
    return new Proxy(function () {}, {
        get(_target, key) { const object = factory(), value = object[key]; return typeof value === 'function' ? value.bind(object) : value; },
        apply(_target, receiver, args) { if (!isActive()) return; return Reflect.apply(factory(), receiver, args); }
    });
}
export const React: ReactRuntime = new Proxy({} as ReactRuntime, { get(_target, key: keyof ReactRuntime) {
    if (key === 'Fragment') return ctx().react.Fragment;
    return (...args: unknown[]) => Reflect.apply(ctx().react[key] as Function, ctx().react, args);
} });
export const useRef = React.useRef;
export const classes = (...values: string[]) => values.filter(Boolean).join(' ');
export const isTruthy = <T,>(value: T): value is Exclude<T, false | null | undefined> => !!value;
export function findByCodeLazy(...parts: string[]): any { return lazy(() => find(value => typeof value === 'function' && parts.every(part => String(value).includes(part)), parts.join(', '))); }
export function findCssClassesLazy(...parts: string[]): any { return lazy(() => find(value => parts.every(part => typeof value?.[part] === 'string'), 'menu styles')); }
export const GuildRoleStore = lazy(() => find(value => typeof value?.getRole === 'function' && typeof value?.getRolesSnapshot === 'function', 'role store'));
export const PermissionStore = lazy(() => find(value => typeof value?.getGuildPermissionProps === 'function' && typeof value?.can === 'function', 'permission store'));
export const Menu = new Proxy({} as any, { get(_target, key) { return find(value => value?.Menu && value?.MenuItem && value?.MenuGroup, 'menu components')[key]; } });
export const ContextMenuApi = {
    openContextMenu(event: unknown, render: () => unknown): void {
        if (!isActive()) return;
        ownsContextMenu = true;
        find(value => typeof value?.openContextMenu === 'function' && typeof value?.closeContextMenu === 'function', 'context menus').openContextMenu(event, render);
    },
    closeContextMenu(): void { find(value => typeof value?.openContextMenu === 'function' && typeof value?.closeContextMenu === 'function', 'context menus').closeContextMenu(); ownsContextMenu = false; }
};
export function getCurrentChannel(): any {
    const selected = find(value => typeof value?.getChannelId === 'function' && typeof value?.getLastSelectedChannelId === 'function', 'selected channel');
    return find(value => typeof value?.getChannel === 'function' && typeof value?.getDMFromUserId === 'function', 'channel store').getChannel(selected.getChannelId());
}
export function getCurrentGuild(): any {
    const selected = find(value => typeof value?.getGuildId === 'function' && (typeof value?.getLastSelectedGuildId === 'function' || value?.getName?.() === 'SelectedGuildStore'), 'selected server');
    return find(value => typeof value?.getGuild === 'function' && typeof value?.getGuilds === 'function', 'server store').getGuild(selected.getGuildId());
}
export function getIntlMessage(name: string): string {
    const keys: Record<string, string> = { COPY_ID_ROLE: 'sMsaLg' };
    const messages = find(value => value?.[Symbol.toStringTag] === 'IntlMessagesProxy', 'message translations');
    return find(value => typeof value?.intl?.string === 'function', 'localization').intl.string(messages[keys[name]]);
}
export async function editRole(guild: string, role: string): Promise<void> {
    const activation = context;
    if (!isActive(activation)) return;
    try {
        const actions = find(value => typeof value?.open === 'function' && typeof value?.selectRole === 'function' && typeof value?.updateGuild === 'function', 'server settings');
        await actions.open(guild, 'ROLES');
        if (isActive(activation)) actions.selectRole(role);
    } catch (error) { if (isActive(activation)) activation?.notifications.show({ title: 'Could not open the role editor.', body: error instanceof Error ? error.message : String(error), type: 'error' }); }
}
export function copyToClipboard(value: string): void {
    const activation = context;
    if (!isActive(activation)) return;
    void navigator.clipboard.writeText(value).catch(error => activation?.log.error('Could not copy the role value.', error));
}
export function captureDeveloperMode(setting: typeof developerMode): typeof developerMode {
    developerMode = setting;
    if (isActive()) enableDeveloperMode();
    return setting;
}
export function enableDeveloperMode(): void {
    const activation = context;
    if (!isActive(activation) || !developerMode || developerMode.getSetting()) return;
    void developerMode.updateSetting(true).catch(error => activation?.log.error('Could not enable Developer Mode for role context menus.', error));
}
export function captureRoleMemberPopout(component: unknown): void { memberPopout = component; }
export function Popout(props: any): any {
    const component = find(value => { const fn = value?.type ?? value?.render ?? value; return typeof fn === 'function' && ['ref:this.ref,', 'renderPopout:this.renderPopout,'].every(part => String(fn).includes(part)); }, 'popout');
    return React.createElement(component, props);
}
export function RoleMemberPopout(props: any): any {
    const close = props.popoutProps?.closePopout;
    React.useEffect(() => {
        if (typeof close === 'function') popouts.add(close);
        return () => { if (typeof close === 'function') popouts.delete(close); };
    }, [close]);
    if (!memberPopout) throw new Error('Discord role member popout has not loaded. Restart Discord to prepare the role menu.');
    return React.createElement(memberPopout, props);
}
export async function openImageModal(item: Record<string, unknown>): Promise<void> {
    const activation = context;
    if (!isActive(activation) || !activation) return;
    try {
        const predicate = (value: any) => typeof value === 'function' && String(value).includes('hasMediaOptions') && String(value).includes('shouldHideMediaOptions');
        if (!activation.webpack.find(predicate)) await activation.webpack.loadChunks({ find: ['hasMediaOptions', 'shouldHideMediaOptions'] });
        if (!isActive(activation)) return;
        const open = activation.webpack.find<(props: object) => void>(predicate);
        if (!open) throw new Error('Discord image viewer is not available.');
        open({ items: [{ type: 'IMAGE', original: item.original ?? item.url, ...item }] });
    } catch (error) { if (isActive(activation)) activation.notifications.show({ title: 'Could not view the role icon.', body: error instanceof Error ? error.message : String(error), type: 'error' }); }
}
export function ImageIcon(): any {
    return React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'currentColor' },
        React.createElement('path', { d: 'M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2ZM8.5 13.5l2.5 3L14.5 12l4.5 6H5l3.5-4.5Z' }));
}
export function CopyIdIcon(): any {
    return React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'currentColor' },
        React.createElement('path', { d: 'M4 2a2 2 0 0 0-2 2v12h2V4h12V2H4Zm4 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H8Zm0 2h12v12H8V8Z' }));
}
