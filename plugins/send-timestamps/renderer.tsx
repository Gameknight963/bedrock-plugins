/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, RendererSettingsContext, RendererSettingsProps } from '@bedrock/renderer';
declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } interface IntrinsicAttributes { key?: string | number } } }
let context: RendererContext;
const modals = new Map<string, () => void>();
export const settings = Bedrock.definePluginSettings({
    replaceMessageContents: { type: Bedrock.OptionType.BOOLEAN, label: 'Convert time shortcuts', description: 'Replace backtick-wrapped times such as `17:59` with Discord timestamps.', default: true }
});
const formats = ['', 't', 'T', 'd', 'D', 'f', 'F', 's', 'S', 'R'] as const;
type Format = typeof formats[number];
export function parseTime(time: string): string {
    const clean = time.slice(1, -1).replace(/(\d)(AM|PM)$/i, '$1 $2');
    let seconds = new Date(`${new Date().toDateString()} ${clean}`).getTime() / 1000;
    if (Number.isNaN(seconds)) return time;
    if (Date.now() / 1000 > seconds) seconds += 86400;
    return `<t:${Math.round(seconds)}:t>`;
}
export function formatTimestamp(seconds: number, format: Format): string { return `<t:${seconds}${format ? `:${format}` : ''}>`; }
function find(ctx: RendererSettingsContext, predicate: (value: any) => boolean, name: string): any {
    const result = ctx.webpack.find(predicate);
    if (!result) throw new Error(`Discord's ${name} is not available.`);
    return result;
}
function component(ctx: RendererSettingsContext, name: string, ...parts: string[]): any {
    return find(ctx, value => { const fn = value?.type ?? value?.render ?? value; return typeof fn === 'function' && parts.every(part => String(fn).includes(part)); }, name);
}
function renderTimestamp(ctx: RendererSettingsContext, text: string): any {
    return find(ctx, value => typeof value?.parse === 'function' && typeof value?.parseTopic === 'function', 'message parser').parse(text);
}
function insert(ctx: RendererContext, text: string): void {
    find(ctx, value => typeof value?.dispatchToLastSubscribed === 'function', 'chat input').dispatchToLastSubscribed('INSERT_TEXT', { plainText: text });
}
export function PickerModal({ ctx, ...props }: any): any {
    const React = ctx.react as RendererContext['react'];
    const [value, setValue] = React.useState('');
    const [format, setFormat] = React.useState<Format>('');
    const time = Math.round((new Date(value).getTime() || Date.now()) / 1000);
    const formatted = formatTimestamp(time, format);
    const rendered = renderTimestamp(ctx, formatted);
    const Modal = component(ctx, 'modal', 'leadingLayout:', 'actions:', '.message');
    const Select = component(ctx, 'select', 'selectionMode:"single",onSelectionChange:', 'isSelected:');
    const light = document.documentElement.classList.contains('theme-light');
    return <Modal {...props} title="Timestamp Picker" actions={[{ text: 'Insert', variant: 'primary', onClick() { if (ctx.signal.aborted) return; insert(ctx, `${formatted} `); props.onClose(); } }]}>
        <input className="vc-st-date-picker" type="datetime-local" value={value} onChange={(event: { currentTarget: HTMLInputElement }) => setValue(event.currentTarget.value)} style={{ colorScheme: light ? 'light' : 'dark' }} />
        <h5 style={{ fontSize: 12, fontWeight: 700, margin: '0 0 8px', textTransform: 'uppercase' }}>Timestamp Format</h5>
        <div className="vc-st-format-select"><Select options={formats.map(value => ({ label: value, value }))} isSelected={(option: Format) => option === format}
            select={(option: Format) => setFormat(option)} serialize={(option: Format) => option}
            renderOptionLabel={(option: { value: Format }) => <div className="vc-st-format-label">{renderTimestamp(ctx, formatTimestamp(time, option.value))}</div>}
            renderOptionValue={() => rendered} /></div>
        <h5 style={{ fontSize: 12, fontWeight: 700, margin: '0 0 8px', textTransform: 'uppercase' }}>Preview</h5>
        <p className="vc-st-preview-text">{rendered} ({formatted})</p>
    </Modal>;
}
export function openPicker(): void {
    const activation = context;
    if (activation.signal.aborted) return;
    try {
        const open = component(activation, 'modal opener', ',instant:');
        const close = component(activation, 'modal closer', '.onCloseCallback()');
        const key = open((props: object) => activation.react.createElement(PickerModal, { ...props, ctx: activation }), { onCloseCallback: () => modals.delete(key) });
        modals.set(key, () => close(key));
    } catch (error) { activation.notifications.show({ title: 'Could not open the timestamp picker.', body: error instanceof Error ? error.message : String(error), type: 'error' }); }
}
function Icon(): any {
    const React = context.react;
    return <svg aria-hidden="true" role="img" width="20" height="20" viewBox="0 0 24 24" style={{ scale: '1.2' }}><g fill="none" fillRule="evenodd">
        <path fill="currentColor" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7v-5z" />
        <rect width="24" height="24" /></g></svg>;
}
export function Settings({ ctx }: RendererSettingsProps): any {
    const React = ctx.react;
    return <><p>Wrap a time in backticks to turn it into a Discord timestamp. Use the date button in the chat bar for a specific date or a different format.</p>
        <ul>{['12:00', '3:51', '17:59', '24:00', '12:00 AM', '0:13PM'].map(sample => <li key={sample}><code>{`\`${sample}\``}</code> {'\u2192'} {renderTimestamp(ctx, parseTime(`\`${sample}\``))}</li>)}</ul></>;
}
export async function start(ctx: RendererContext): Promise<void> {
    context = ctx;
    const response = await fetch(new URL('./styles.css', import.meta.url), { signal: ctx.signal });
    if (!response.ok) throw new Error(`Could not load timestamp picker styles (HTTP ${response.status}).`);
    const css = await response.text();
    if (ctx.signal.aborted) return;
    ctx.styles.add(css);
    ctx.messages.beforeSend(event => { if (settings.store.replaceMessageContents) event.message.content = event.message.content.replace(/`\d{1,2}:\d{2} ?(?:AM|PM)?`/gi, parseTime); });
    ctx.chatBar.addButton('send-timestamps', props => props.isAnyChat === false ? null : ctx.chatBar.button({ label: 'Insert Timestamp', icon: ctx.react.createElement(Icon), onClick: openPicker }));
}
export function stop(): void { for (const close of modals.values()) close(); modals.clear(); }
