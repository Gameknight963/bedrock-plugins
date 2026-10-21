/* Copyright (c) 2026 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-21. See NOTICE. */
import type { MenuChild, RendererContext, SourcePatch } from '@bedrock/renderer';
let context: RendererContext | undefined;
let Boundary: any;
let nativeReact: RendererContext['react'] | undefined;
interface PrivateChannelsList { forceUpdate(): void; props?: { privateChannelIds: string[] } }
let instance: PrivateChannelsList | undefined;
let showHiddenDms = false;
const hiddenDmIds = new Set<string>();
// Discord's list assigns the filtered array to its props. Remember the original so it can be restored.
const originalIds = new WeakMap<string[], string[]>();
const React = { createElement(type: any, props: any, ...children: any[]): any { return nativeReact?.createElement(type, props, ...children); } };
declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } } }
export const settings = Bedrock.definePluginSettings({ hidePopoverButton: { label: 'Hide hover button', type: Bedrock.OptionType.BOOLEAN, description: 'Keep Hide in the message context menu, without adding a hover button.', default: false } });
export function EyeIcon(props: any): any {
    return <svg width="24" height="24" {...props} viewBox="0 0 24 24"><path fill={props.fill || 'currentColor'} d="M15.56 11.77c.2-.1.44.02.44.23a4 4 0 1 1-4-4c.21 0 .33.25.23.44a2.5 2.5 0 0 0 3.32 3.32Z" /><path fillRule="evenodd" clipRule="evenodd" fill={props.fill || 'currentColor'} d="M22.89 11.7c.07.2.07.4 0 .6C22.27 13.9 19.1 21 12 21c-7.11 0-10.27-7.11-10.89-8.7a.83.83 0 0 1 0-.6C1.73 10.1 4.9 3 12 3c7.11 0 10.27 7.11 10.89 8.7Zm-4.5-3.62A15.11 15.11 0 0 1 20.85 12c-.38.88-1.18 2.47-2.46 3.92C16.87 17.62 14.8 19 12 19c-2.8 0-4.87-1.38-6.39-3.08A15.11 15.11 0 0 1 3.15 12c.38-.88 1.18-2.47 2.46-3.92C7.13 6.38 9.2 5 12 5c2.8 0 4.87 1.38 6.39 3.08Z" /></svg>;
}
function active(): boolean { return !!context && !context.signal.aborted; }
function find(predicate: (value: any) => boolean, name: string): any {
    const value = context?.webpack.find(predicate);
    if (!value) throw new Error(`Hide Messages could not find Discord's ${name}.`);
    return value;
}
export function hideMessage(messageId: string, channelId: string): void {
    if (!active()) return;
    find(value => typeof value?.dispatch === 'function' && typeof value?.subscribe === 'function', 'dispatcher').dispatch({ type: 'MESSAGE_DELETE', id: messageId, channelId, mlDeleted: true });
}
export function toggleDm(channelId: string): void {
    if (!active()) return;
    if (hiddenDmIds.has(channelId)) { hiddenDmIds.delete(channelId); if (!hiddenDmIds.size) showHiddenDms = false; }
    else hiddenDmIds.add(channelId);
    instance?.forceUpdate();
}
export function filterPrivateChannelIds(ids: string[], list?: PrivateChannelsList): string[] {
    const original = originalIds.get(ids) ?? ids;
    if (list) instance = list;
    if (!active() || showHiddenDms) return original;
    const filtered = original.filter(id => !hiddenDmIds.has(id));
    originalIds.set(filtered, original);
    return filtered;
}
function isPinned(channelId: string): boolean {
    const runtime = Bedrock as unknown as { plugins: { list(): Array<{ manifest: { id: string }; enabled: boolean }> }; _sourcePlugin?(id: string): { plugin?: { isPinned?(id: string): boolean } } };
    const id = 'gameknight963.pin-dms';
    return !!runtime.plugins.list().some(item => item.manifest.id === id && item.enabled) && !!runtime._sourcePlugin?.(id)?.plugin?.isPinned?.(channelId);
}
function groupWithId(children: MenuChild[], id: string): MenuChild[] | undefined {
    if (children.some(child => child && typeof child === 'object' && !Array.isArray(child) && child.props.id === id)) return children;
    for (const child of children) {
        if (!child || typeof child !== 'object' || Array.isArray(child)) continue;
        if (Array.isArray(child.props.children)) { const group = groupWithId(child.props.children as MenuChild[], id); if (group) return group; }
    }
}
function HiddenMessagesToggle(): any {
    if (!active()) return null;
    const hasHiddenDms = hiddenDmIds.size > 0;
    const label = !hasHiddenDms ? 'No Hidden DMs' : showHiddenDms ? 'Hide Hidden DMs' : 'Show Hidden DMs';
    const Tooltip = find(value => typeof value === 'function' && value.prototype?.shouldShowTooltip && value.prototype?.render, 'tooltip');
    const Clickable = find(value => { const fn = value?.type || value?.render || value; return typeof fn === 'function' && String(fn).includes('this.context?this.renderNonInteractive():'); }, 'clickable');
    return React.createElement(Tooltip, { text: label, children: (tooltipProps: any) => React.createElement(Clickable, {
        ...tooltipProps, className: 'vc-hide-messages-eye', role: 'button', tabIndex: 0, 'aria-label': label, 'aria-disabled': !hasHiddenDms,
        onClick(event: MouseEvent) {
            event.preventDefault(); event.stopPropagation();
            if (!active() || !hiddenDmIds.size) return;
            showHiddenDms = !showHiddenDms; instance?.forceUpdate();
        }
    }, <EyeIcon width={14} height={14} />) });
}
export function renderHiddenMessagesToggle(): any {
    if (!active()) return null;
    const ctx = context!, NativeReact = ctx.react as any;
    Boundary ||= class extends NativeReact.Component {
        state = { failed: false };
        static getDerivedStateFromError() { return { failed: true }; }
        componentDidCatch(error: Error) { ctx.log.error('Could not display the hidden-DM toggle.', error); }
        render() { return this.state.failed ? null : this.props.children; }
    };
    return React.createElement(Boundary, null, <HiddenMessagesToggle />);
}
const identifier = '(?:[A-Za-z_$][\\w$]*)';
export const patches: SourcePatch[] = [{ id: 'hidden-dm-list', find: '"dm-quick-launcher"===', replacement: [
    { match: /render\(\)\{/, replace: '$&this.props.privateChannelIds=$self.filterPrivateChannelIds(this.props.privateChannelIds,this);' },
    { match: new RegExp(String.raw`renderRow(?:",|=)\i=>\{`.replaceAll('\\i', identifier)), replace: '$&this.props.privateChannelIds=$self.filterPrivateChannelIds(this.props.privateChannelIds,this);' },
    { match: new RegExp(String.raw`renderDM(?:",|=)\(\i,\i\)=>\{`.replaceAll('\\i', identifier)), replace: '$&this.props.privateChannelIds=$self.filterPrivateChannelIds(this.props.privateChannelIds,this);' },
    { match: /\.YUU0RF\)\}\),/, replace: '$&$self.renderHiddenMessagesToggle(),' }
] }];
export function start(ctx: RendererContext): void {
    context = ctx; nativeReact = ctx.react; Boundary = undefined; hiddenDmIds.clear(); showHiddenDms = false;
    ctx.styles.add('.vc-hide-messages-eye{width:16px;height:16px;margin-right:.2rem;display:flex;align-items:center;justify-content:center}');
    ctx.contextMenus.patch<{ message?: { id: string; channel_id: string } }>('message', (children, { message }) => {
        if (!message) return;
        const group = groupWithId(children, 'copy-text');
        if (!group) return;
        const item = ctx.contextMenus.item({ id: 'vc-hidemessages', label: 'Hide', icon: EyeIcon, leadingAccessory: { type: 'icon', icon: EyeIcon }, action: () => hideMessage(message.id, message.channel_id) });
        group.splice(group.findIndex((child: any) => child?.props?.id === 'copy-text') + 1, 0, item);
    });
    ctx.contextMenus.patch<{ channel?: { id: string; isDM(): boolean } }>('user-context', (children, { channel }) => {
        if (!channel?.isDM() || isPinned(channel.id)) return;
        const group = groupWithId(children, 'close-dm');
        if (!group) return;
        const item = ctx.contextMenus.item({ id: 'vc-hidemessages-dm', label: hiddenDmIds.has(channel.id) ? 'Unhide DM' : 'Hide DM', icon: EyeIcon, leadingAccessory: { type: 'icon', icon: EyeIcon }, action: () => toggleDm(channel.id) });
        group.splice(group.findIndex((child: any) => child?.props?.id === 'close-dm'), 0, item);
    });
    ctx.messages.addButton('hide', ({ message }) => settings.store.hidePopoverButton ? null : { label: 'Hide', icon: EyeIcon, onClick: () => hideMessage(message.id, String(message.channel_id)) });
}
export function stop(): void {
    context = undefined; hiddenDmIds.clear(); showHiddenDms = false;
    if (instance?.props) instance.props.privateChannelIds = originalIds.get(instance.props.privateChannelIds) ?? instance.props.privateChannelIds;
    instance?.forceUpdate(); instance = undefined;
}
