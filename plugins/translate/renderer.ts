/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { ChatBarProps, MenuChild, MenuElement, MessageInfo, RendererContext } from '@bedrock/renderer';
import type { TranslationValue } from './main.js';
import { settings, getLanguages, configureLanguages, getLanguage, setLanguage } from './settings.js';
export { settings };

type LanguageKey = 'receivedInput' | 'receivedOutput' | 'sentInput' | 'sentOutput';
interface Pending { resolve(value: TranslationValue): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }
let context: RendererContext;
const pending = new Map<string, Pending>(), translations = new Map<string, TranslationValue>();
const subscribers = new Set<() => void>(), modals = new Map<string, () => void>(), notices = new Set<string>();
let showNotice = false, noticeTimer: ReturnType<typeof setTimeout> | undefined;
const changed = () => { for (const callback of subscribers) callback(); };
const languageLabels: Record<LanguageKey, string> = {
    receivedInput: 'Language incoming messages are translated from', receivedOutput: 'Language incoming messages are translated to',
    sentInput: 'Language your messages are translated from', sentOutput: 'Language your messages are translated to'
};
function byCode<T>(name: string, ...parts: string[]): T {
    const value = context.webpack.find<T>(value => typeof value === 'function' && parts.every(part => Function.prototype.toString.call(value).includes(part)));
    if (!value) throw new Error(`Discord's ${name} is not available yet.`);
    return value;
}
function failure(error: unknown): void {
    if (!context.signal.aborted) context.notifications.show({ title: 'Could not translate', body: error instanceof Error ? error.message : 'The translation request failed.', type: 'error' });
}
export function getMessageContent(message: MessageInfo): string {
    const value = message as MessageInfo & { messageSnapshots?: { message: { content?: string } }[]; embeds?: { type: string; rawDescription?: string }[] };
    return value.content || value.messageSnapshots?.[0]?.message.content || value.embeds?.find(embed => embed.type === 'auto_moderation_message')?.rawDescription || '';
}
export function translate(kind: 'sent' | 'received', text: string): Promise<TranslationValue> {
    const activation = context;
    if (activation.signal.aborted) return Promise.reject(new Error('Translate was disabled.'));
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('The translation request timed out.')); }, 30000);
        pending.set(requestId, { resolve, reject, timer });
        void activation.events.emit('translate.request', { requestId, text, source: getLanguage(`${kind}Input`), target: getLanguage(`${kind}Output`) }).catch(error => {
            const request = pending.get(requestId);
            if (request) { pending.delete(requestId); clearTimeout(timer); reject(error); }
        });
    });
}
async function translateMessage(message: MessageInfo): Promise<void> {
    const activation = context;
    try {
        const value = await translate('received', getMessageContent(message));
        if (activation.signal.aborted || activation !== context) return;
        translations.set(message.id, value); changed();
    } catch (error) { if (activation === context) failure(error); }
}
export function TranslateIcon(props: { width?: number; height?: number; className?: string } = {}): MenuElement {
    return context.react.createElement('svg', { viewBox: '0 96 960 960', height: props.height ?? 20, width: props.width ?? 20, className: props.className },
        context.react.createElement('path', { fill: 'currentColor', d: 'm475 976 181-480h82l186 480h-87l-41-126H604l-47 126h-82Zm151-196h142l-70-194h-2l-70 194Zm-466 76-55-55 204-204q-38-44-67.5-88.5T190 416h87q17 33 37.5 62.5T361 539q45-47 75-97.5T487 336H40v-80h280v-80h80v80h280v80H567q-22 69-58.5 135.5T419 598l98 99-30 81-127-122-200 200Z' }));
}
function Accessory({ message }: { message: MessageInfo }): MenuElement | null {
    const React = context.react;
    React.useSyncExternalStore(callback => { subscribers.add(callback); return () => subscribers.delete(callback); }, () => translations.get(message.id));
    const value = translations.get(message.id);
    if (!value) return null;
    const parser = context.webpack.find<{ parse(text: string): MenuChild }>(value => typeof value?.parse === 'function' && typeof value?.parseTopic === 'function');
    return React.createElement('span', { className: 'bedrock-trans-accessory' },
        React.createElement(TranslateIcon, { width: 16, height: 16, className: 'bedrock-trans-accessory-icon' }),
        parser ? parser.parse(value.text) : value.text, React.createElement('br'),
        `(translated from ${getLanguages(value.provider)[value.sourceLanguage] ?? value.sourceLanguage} - `,
        React.createElement('button', { className: 'bedrock-trans-dismiss', onClick() { translations.delete(message.id); changed(); } }, 'Dismiss'), ')');
}
function openModal(render: (props: Record<string, unknown>) => MenuElement): void {
    const open = byCode<(render: (props: Record<string, unknown>) => MenuElement, options: { onCloseCallback(): void }) => string>('modal opener', ',instant:');
    const close = byCode<(key: string) => void>('modal closer', '.onCloseCallback()');
    const key = open(render, { onCloseCallback() { modals.delete(key); } });
    modals.set(key, () => close(key));
}
async function toggleAutoTranslate(): Promise<void> {
    const enabled = !settings.store.autoTranslate;
    await settings.set('autoTranslate', enabled);
    if (!enabled || context.signal.aborted || context.settings.get('dismissedAutoTranslateAlert', false)) return;
    const ConfirmModal = byCode<unknown>('confirmation modal', 'actionBarInput:', '"critical"', '"secondary');
    function Confirmation(props: Record<string, unknown>): MenuElement {
        const [dismissed, setDismissed] = context.react.useState(context.settings.get('dismissedAutoTranslateAlert', false));
        return context.react.createElement(ConfirmModal, { ...props, title: 'Auto Translate Enabled',
            subtitle: 'Any message you send will automatically be translated before being sent.', confirmText: 'Disable Auto-Translate', cancelText: 'Got it', variant: 'primary',
            onConfirm: () => settings.set('autoTranslate', false), checkboxProps: { checked: dismissed, onChange(value: boolean) { setDismissed(value); void context.settings.set('dismissedAutoTranslateAlert', value); } } });
    }
    openModal(props => context.react.createElement(Confirmation, props));
}
function LanguageDialog({ Select }: { Select: unknown }): MenuElement {
    const React = context.react;
    const values = settings.use(['service', 'autoTranslate']);
    const languageKeys = ['receivedInput', 'receivedOutput', 'sentInput', 'sentOutput'] as const;
    const snapshot = () => JSON.stringify(Object.fromEntries(languageKeys.map(key => [key, getLanguage(key)])));
    const languages = JSON.parse(React.useSyncExternalStore(callback => context.events.on('settings.changed', event => { if (event.id === context.id) callback(); }), snapshot)) as Record<LanguageKey, string>;
    const options = Object.entries(getLanguages(values.service)).map(([value, label]) => ({ value, label }));
    return React.createElement('div', { className: 'bedrock-trans-languages' },
        ...(['receivedInput', 'receivedOutput', 'sentInput', 'sentOutput'] as const).map(key => React.createElement('section', { key },
            React.createElement('h3', null, languageLabels[key]),
            React.createElement(Select, { options: options.filter(option => key.endsWith('Input') || !['', 'auto'].includes(option.value)), value: languages[key],
                placeholder: 'Select a language', maxVisibleItems: 5, closeOnSelect: true, onChange: (value: string) => setLanguage(key, value) }))),
        React.createElement('hr'), React.createElement('div', { className: 'bedrock-trans-auto-row' },
            React.createElement('label', { htmlFor: 'bedrock-trans-auto' }, 'Auto Translate'),
            React.createElement('button', { id: 'bedrock-trans-auto', type: 'button', role: 'switch', 'aria-checked': values.autoTranslate,
                className: 'bedrock-trans-switch', onClick() { void toggleAutoTranslate().catch(failure); } }, React.createElement('span'))),
        React.createElement('p', { className: 'bedrock-trans-explanation' }, settings.definitions.autoTranslate.description));
}
export function openTranslateModal(): void {
    try {
        const Modal = byCode<unknown>('modal', 'leadingLayout:', 'actions:', '.message');
        const Select = byCode<unknown>('language picker', '?"multiple":"single",required:');
        openModal(props => context.react.createElement(Modal, { ...props, title: 'Translate' }, context.react.createElement(LanguageDialog, { Select })));
    } catch (error) { failure(error); }
}
function ChatButton(props: ChatBarProps): MenuElement | null {
    const React = context.react;
    const values = settings.use(['autoTranslate', 'showAutoTranslateTooltip']);
    React.useSyncExternalStore(callback => { subscribers.add(callback); return () => subscribers.delete(callback); }, () => showNotice);
    if (props.type?.analyticsName && props.type.analyticsName !== 'normal') return null;
    let button = context.chatBar.button({ label: 'Open Translate Modal', icon: React.createElement(TranslateIcon, { className: values.autoTranslate ? 'bedrock-trans-auto-translate' : undefined }),
        disabled: props.disabled, pressed: values.autoTranslate, onClick(event) { if (event.shiftKey) return toggleAutoTranslate(); openTranslateModal(); } });
    button = React.cloneElement(button, { 'aria-haspopup': 'dialog', onContextMenu(event: { preventDefault(): void }) { event.preventDefault(); void toggleAutoTranslate().catch(failure); } });
    const Tooltip = context.webpack.find<unknown>(value => typeof value === 'function' && value.prototype?.shouldShowTooltip && value.prototype.render);
    if (showNotice && values.showAutoTranslateTooltip && Tooltip) return React.createElement(Tooltip, { text: 'Auto Translate Enabled', forceOpen: true }, ((props: Record<string, unknown>) => React.cloneElement(button, props)) as unknown as MenuElement);
    return button;
}
function addMenuItem(children: MenuChild[], entry: MenuElement): boolean {
    for (let index = 0; index < children.length; index++) {
        const child = children[index];
        if (context.react.isValidElement(child) && child.props.id === 'copy-text') { children.splice(index + 1, 0, entry); return true; }
        if (Array.isArray(child) && addMenuItem(child, entry)) return true;
        if (context.react.isValidElement(child) && Array.isArray(child.props.children) && addMenuItem(child.props.children as MenuChild[], entry)) return true;
    }
    return false;
}
function cancelPending(): void {
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('Translate was disabled.')); }
    pending.clear();
}
export function start(ctx: RendererContext): void {
    context = ctx;
    configureLanguages(ctx.settings);
    ctx.signal.addEventListener('abort', cancelPending, { once: true });
    ctx.events.on('translate.response', ({ id, value }) => {
        if (id !== ctx.id || !value || typeof value.requestId !== 'string') return;
        const request = pending.get(value.requestId);
        if (!request) return;
        pending.delete(value.requestId); clearTimeout(request.timer);
        if (typeof value.error === 'string') { request.reject(new Error(value.error)); return; }
        if (typeof value.translation?.text !== 'string' || typeof value.translation?.sourceLanguage !== 'string') { request.reject(new Error('The provider returned an invalid translation.')); return; }
        if (value.translation.notice && !notices.has(value.translation.notice)) { notices.add(value.translation.notice); ctx.notifications.show({ title: value.translation.notice }); }
        request.resolve(value.translation);
    });
    ctx.messages.addButton('translate', ({ message }) => getMessageContent(message) ? { label: 'Translate', icon: TranslateIcon, onClick: () => translateMessage(message) } : null);
    ctx.contextMenus.patch<{ message?: MessageInfo }>('message', (children, { message }) => {
        if (!message || !getMessageContent(message)) return;
        const item = ctx.contextMenus.item({ id: 'bedrock-translate', label: 'Translate', leadingAccessory: { type: 'icon', icon: TranslateIcon }, action() { void translateMessage(message); } });
        if (!addMenuItem(children, item)) children.push(item);
    });
    ctx.messages.addAccessory('translation', Accessory);
    ctx.chatBar.addButton('translate', ChatButton);
    ctx.messages.beforeSend(async event => {
        if (!settings.store.autoTranslate || !event.message.content.trim()) return;
        try {
            const value = await translate('sent', event.message.content);
            if (ctx.signal.aborted) return;
            event.message.content = value.text;
            showNotice = true; changed(); clearTimeout(noticeTimer);
            noticeTimer = setTimeout(() => { showNotice = false; changed(); }, 2000);
        } catch (error) { if (!ctx.signal.aborted) failure(error); throw error; }
    });
    ctx.styles.add('.bedrock-trans-accessory{color:var(--text-muted);margin-top:.5em;font-style:italic;font-weight:400;line-height:1.2rem;white-space:break-spaces}.bedrock-trans-accessory-icon{margin-right:.25em}.bedrock-trans-dismiss{all:unset;cursor:pointer;color:var(--text-link)}.bedrock-trans-dismiss:is(:hover,:focus){text-decoration:underline}.bedrock-trans-auto-translate{color:var(--green-360)}.bedrock-trans-languages section{margin-bottom:16px}.bedrock-trans-languages h3{font-size:14px;font-weight:600;margin:0 0 8px;color:var(--text-default)}.bedrock-trans-languages hr{border:0;border-top:1px solid var(--border-subtle);margin:16px 0}.bedrock-trans-auto-row{display:flex;justify-content:space-between;align-items:center}.bedrock-trans-explanation{color:var(--text-muted);font-size:14px;line-height:1.4}.bedrock-trans-switch{position:relative;width:40px;height:24px;border:0;border-radius:12px;background:var(--interactive-muted);cursor:pointer}.bedrock-trans-switch[aria-checked=true]{background:var(--green-360)}.bedrock-trans-switch span{position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:white;transition:transform .1s}.bedrock-trans-switch[aria-checked=true] span{transform:translateX(16px)}');
}
export function stop(): void {
    context.signal.removeEventListener('abort', cancelPending); cancelPending(); clearTimeout(noticeTimer);
    for (const close of [...modals.values()]) close();
    modals.clear(); translations.clear(); notices.clear(); showNotice = false; changed(); subscribers.clear();
}
