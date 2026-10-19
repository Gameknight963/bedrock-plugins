/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { MenuActionEvent, MenuChild, MenuElement, MessageInfo, RendererContext } from '@bedrock/renderer';

let context: RendererContext, Boundary: unknown;
const modals = new Map<string, () => void>();
const sensitive = new Set(['email', 'phone', 'storeCountry', 'personalConnectionId', 'token', 'accessToken', 'refreshToken']);
export const settings = Bedrock.definePluginSettings({
    clickMethod: { type: Bedrock.OptionType.SELECT, label: 'Click Method', description: 'Choose which click opens the message viewer.', default: 'Left', options: [
        { label: 'Left-click to view, right-click to copy', value: 'Left' }, { label: 'Right-click to view, left-click to copy', value: 'Right' }
    ] },
    messageContextMenu: { type: Bedrock.OptionType.BOOLEAN, label: 'Message Context Menu', description: 'Show View Raw in the message context menu.', default: false },
    sortKeys: { type: Bedrock.OptionType.BOOLEAN, label: 'Sort Keys', description: 'Sort data keys alphabetically.', default: true },
    stripSensitiveData: { type: Bedrock.OptionType.BOOLEAN, label: 'Strip Sensitive Data', description: 'Remove personal fields such as email addresses and phone numbers from the JSON.', default: true }
});
function notifyError(error: unknown): void {
    if (!context.signal.aborted) context.notifications.show({ title: 'Could not view or copy raw data', body: error instanceof Error ? error.message : 'The action failed.', type: 'error' });
}
export function serialize(data: unknown, type: string): string {
    const ancestors: object[] = [];
    const plain = JSON.parse(JSON.stringify(data, function (key, value) {
        if (settings.store.stripSensitiveData && sensitive.has(key)) return undefined;
        if (typeof value === 'bigint') return String(value);
        if (value && typeof value === 'object') {
            while (ancestors.length && ancestors.at(-1) !== this) ancestors.pop();
            if (ancestors.includes(value)) return '[Circular]';
            ancestors.push(value);
        }
        return value;
    }));
    if (type === 'Message') {
        for (const key of ['editHistory', 'deleted', 'firstEditTimestamp']) delete plain[key];
        for (const attachment of plain.attachments ?? []) delete attachment.deleted;
    }
    function sort(value: any): any {
        if (!settings.store.sortKeys || value === null || typeof value !== 'object') return value;
        if (Array.isArray(value)) return value.map(sort);
        return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sort(item)]));
    }
    return JSON.stringify(sort(plain), null, 4);
}
async function copy(text: string, message = 'Content copied to clipboard!'): Promise<void> {
    const activation = context;
    if (activation.signal.aborted) return;
    try { await navigator.clipboard.writeText(text); if (!activation.signal.aborted && activation === context) context.notifications.show({ title: message, type: 'success' }); }
    catch (error) { if (activation === context) notifyError(error); }
}
function byCode<T>(name: string, ...parts: string[]): T {
    const value = context.webpack.find<T>(value => typeof value === 'function' && parts.every(part => Function.prototype.toString.call(value).includes(part)));
    if (!value) throw new Error(`Discord's ${name} is not available yet.`);
    return value;
}
function CodeBlock({ text, language }: { text: string; language: string }): MenuElement {
    const parser = context.webpack.find<{ defaultRules: { codeBlock: { react(props: Record<string, unknown>, output: null, state: object): MenuChild } } }>(value => typeof value?.defaultRules?.codeBlock?.react === 'function');
    const classes = context.webpack.find<{ markup: string }>(value => typeof value?.markup === 'string' && typeof value?.codeContainer === 'string');
    return parser ? context.react.createElement('div', { className: `bedrock-view-raw-code ${classes?.markup ?? ''}` }, parser.defaultRules.codeBlock.react({ content: text, lang: language }, null, {})) :
        context.react.createElement('pre', { className: 'bedrock-view-raw-code' }, context.react.createElement('code', null, text));
}
export function openRaw(data: unknown, type: string, content?: string): void {
    if (context.signal.aborted) return;
    try {
        const json = serialize(data, type), React = context.react;
        const Modal = byCode<unknown>('modal', 'leadingLayout:', 'actions:', '.message');
        const open = byCode<(render: (props: Record<string, unknown>) => MenuElement, options: { onCloseCallback(): void }) => string>('modal opener', ',instant:');
        const close = byCode<(key: string) => void>('modal closer', '.onCloseCallback()');
        if (!Boundary) {
            const NativeReact = React as typeof React & { Component: any };
            Boundary = class extends NativeReact.Component {
                state = { failed: false };
                static getDerivedStateFromError() { return { failed: true }; }
                componentDidCatch(error: unknown) { notifyError(error); }
                render() { return this.state.failed ? React.createElement('p', null, 'Could not display this data.') : this.props.children; }
            };
        }
        const actions = [{ text: `Copy ${type} Data`, variant: 'secondary', onClick: () => copy(json, `${type} data copied to clipboard!`) },
            ...(content ? [{ text: 'Copy Raw Content', variant: 'secondary', onClick: () => copy(content) }] : [])];
        const key = open(props => React.createElement(Boundary, null, React.createElement(Modal, { ...props, title: `Raw ${type} Data`, size: 'xl', actions },
            content ? React.createElement(React.Fragment, null, React.createElement('h3', { className: 'bedrock-view-raw-heading' }, 'Message Content'), React.createElement(CodeBlock, { text: content, language: '' }),
                React.createElement('h3', { className: 'bedrock-view-raw-heading' }, 'Message Data')) : null,
            React.createElement(CodeBlock, { text: json, language: 'json' }))), { onCloseCallback() { modals.delete(key); } });
        modals.set(key, () => close(key));
    } catch (error) { notifyError(error); }
}
function RawIcon(props: { width?: number; height?: number; className?: string } = {}): MenuElement {
    return context.react.createElement('svg', { viewBox: '0 0 20 20', fill: 'currentColor', 'aria-hidden': true, width: props.width ?? 20, height: props.height ?? 20, className: props.className },
        context.react.createElement('path', { d: 'M12.9297 3.25007C12.7343 3.05261 12.4154 3.05226 12.2196 3.24928L11.5746 3.89824C11.3811 4.09297 11.3808 4.40733 11.5739 4.60245L16.5685 9.64824C16.7614 9.84309 16.7614 10.1569 16.5685 10.3517L11.5739 15.3975C11.3808 15.5927 11.3811 15.907 11.5746 16.1017L12.2196 16.7507C12.4154 16.9477 12.7343 16.9474 12.9297 16.7499L19.2604 10.3517C19.4532 10.1568 19.4532 9.84314 19.2604 9.64832L12.9297 3.25007Z' }),
        context.react.createElement('path', { d: 'M8.42616 4.60245C8.6193 4.40733 8.61898 4.09297 8.42545 3.89824L7.78047 3.24928C7.58466 3.05226 7.26578 3.05261 7.07041 3.25007L0.739669 9.64832C0.5469 9.84314 0.546901 10.1568 0.739669 10.3517L7.07041 16.7499C7.26578 16.9474 7.58465 16.9477 7.78047 16.7507L8.42545 16.1017C8.61898 15.907 8.6193 15.5927 8.42616 15.3975L3.43155 10.3517C3.23869 10.1569 3.23869 9.84309 3.43155 9.64824L8.42616 4.60245Z' }));
}
function insertBeforeId(children: MenuChild[], item: MenuElement): boolean {
    for (let index = 0; index < children.length; index++) {
        const child = children[index];
        if (context.react.isValidElement(child) && typeof child.props.id === 'string' && child.props.id.startsWith('devmode-copy-id')) { children.splice(index, 0, item); return true; }
        if (Array.isArray(child) && insertBeforeId(child, item)) return true;
        if (context.react.isValidElement(child) && Array.isArray(child.props.children) && insertBeforeId(child.props.children as MenuChild[], item)) return true;
    }
    return false;
}
function store<T>(name: string, predicate: (value: any) => boolean): T | undefined { return context.webpack.find<T>(value => predicate(value) && (typeof value.getName !== 'function' || value.getName() === name)); }
export function start(ctx: RendererContext): void {
    context = ctx; Boundary = undefined;
    ctx.messages.addButton('view-raw', ({ message }) => {
        const { clickMethod } = settings.use(['clickMethod']);
        return {
            label: clickMethod === 'Right' ? 'Copy Raw (Left Click) / View Raw (Right Click)' : 'View Raw (Left Click) / Copy Raw (Right Click)',
            icon: RawIcon,
            onClick() { if (settings.store.clickMethod === 'Right') return copy(message.content ?? ''); openRaw(message, 'Message', message.content); },
            onContextMenu(event: MenuActionEvent) { event.preventDefault(); event.stopPropagation(); if (settings.store.clickMethod === 'Left') return copy(message.content ?? ''); openRaw(message, 'Message', message.content); }
        };
    });
    const menus: [string, string, (props: any) => any][] = [
        ['guild-context', 'Guild', props => props.guild], ['guild-settings-role-context', 'Role', props => props.role],
        ['channel-context', 'Channel', props => props.channel], ['thread-context', 'Channel', props => props.channel], ['gdm-context', 'Channel', props => props.channel],
        ['user-context', 'User', props => props.user], ['message', 'Message', props => settings.store.messageContextMenu ? props.message : undefined],
        ['user-profile-overflow-menu', 'Profile', props => {
            if (!props.user?.id) return;
            const profiles = store<{ getGuildMemberProfile(user: string, guild: string): unknown; getUserProfile(user: string): unknown }>('UserProfileStore', value => typeof value?.getUserProfile === 'function' && typeof value?.getGuildMemberProfile === 'function');
            return (props.guildId ? profiles?.getGuildMemberProfile(props.user.id, props.guildId) : undefined) ?? profiles?.getUserProfile(props.user.id);
        }],
        ['dev-context', 'Role', props => {
            const selected = store<{ getChannelId(): string }>('SelectedChannelStore', value => typeof value?.getChannelId === 'function');
            const channels = store<{ getChannel(id: string): { guild_id?: string } | undefined }>('ChannelStore', value => typeof value?.getChannel === 'function');
            const guildId = selected && channels?.getChannel(selected.getChannelId())?.guild_id;
            return guildId ? store<{ getRole(guild: string, id: string): unknown }>('GuildRoleStore', value => typeof value?.getRole === 'function')?.getRole(guildId, props.id) : undefined;
        }]
    ];
    for (const [navId, type, getData] of menus) ctx.contextMenus.patch(navId, (children, props) => {
        const data = getData(props);
        if (!data) return;
        const item = ctx.contextMenus.item({ id: `bedrock-view-${type.toLowerCase()}-raw`, label: 'View Raw', leadingAccessory: { type: 'icon', icon: RawIcon },
            action() { openRaw(data, type, type === 'Message' ? (data as MessageInfo).content : undefined); } });
        if (!insertBeforeId(children, item)) children.splice(Math.max(0, children.length - 1), 0, item);
    });
    ctx.styles.add('.bedrock-view-raw-code,.bedrock-view-raw-code :is(pre,code,[class*="codeContainer"]){max-width:unset;width:100%;box-sizing:border-box;user-select:text}.bedrock-view-raw-code{overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}.bedrock-view-raw-heading{font-size:14px;font-weight:600;color:var(--text-default);margin:16px 0 8px}');
}
export function stop(): void { for (const close of [...modals.values()]) close(); modals.clear(); }
