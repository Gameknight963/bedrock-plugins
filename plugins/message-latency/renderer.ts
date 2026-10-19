/* Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-18. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';

export const settings = Bedrock.definePluginSettings({
    latency: { type: Bedrock.OptionType.NUMBER, label: 'Latency', description: 'Threshold in seconds for the latency indicator.', default: 2, min: 0 },
    detectDiscordKotlin: { type: Bedrock.OptionType.BOOLEAN, label: 'Detect Discord Kotlin', description: 'Detect older Discord Android clients.', default: true },
    showMillis: { type: Bedrock.OptionType.BOOLEAN, label: 'Show Milliseconds', description: 'Show milliseconds.', default: false },
    ignoreSelf: { type: Bedrock.OptionType.BOOLEAN, label: 'Ignore Self', description: "Don't add an indicator to your own messages.", default: false }
});
const identifier = '[A-Za-z_$][\\w$]*';
export const patches: SourcePatch[] = [{ id: 'author-latency-indicator', find: 'showCommunicationDisabledStyles', replacement: {
    match: new RegExp(String.raw`(message:(\i),avatar:\i,username:\(0,\i.jsxs\)\(\i.Fragment,\{children:\[)(\i&&)`.replaceAll('\\i', identifier)),
    replace: '$1$self.renderIndicator({message:$2}),$3'
} }];
interface Message { id: string; nonce?: string | number | null; author: { id: string; bot?: boolean } }
let context: RendererContext;
export function start(ctx: RendererContext): void { context = ctx; }

export function stringDelta(delta: number, showMillis: boolean): string {
    const units: [string, number][] = [['days', Math.floor(delta / 86400000)], ['hours', Math.floor(delta / 3600000) % 24],
        ['minutes', Math.floor(delta / 60000) % 60], ['seconds', Math.floor(delta / 1000) % 60], ['milliseconds', Math.floor(delta % 1000)]];
    let result = '';
    for (const [unit, count] of units) {
        if (!count) continue;
        const separator = result ? (showMillis ? unit === 'milliseconds' : unit === 'seconds') ? ' and ' : ' ' : '';
        result += `${separator}${count} ${count === 1 ? unit.slice(0, -1) : unit}`;
    }
    return result || '0 seconds';
}

export function latencyData(message: Message) {
    if (message.nonce == null || message.author.bot) return null;
    const id = String(message.id), nonce = String(message.nonce);
    if (!/^\d{1,20}$/.test(id) || !/^\d{1,20}$/.test(nonce)) return null;
    const { latency, detectDiscordKotlin, showMillis, ignoreSelf } = settings.store;
    const users = context.webpack.find<{ getCurrentUser(): { id: string } | undefined }>(value => typeof value?.getCurrentUser === 'function' && typeof value?.getUser === 'function');
    if (ignoreSelf && message.author.id === users?.getCurrentUser()?.id) return null;
    let delta = Number((BigInt(id) >> 22n) - (BigInt(nonce) >> 22n));
    if (!showMillis) delta = Math.round(delta / 1000) * 1000;
    let kotlin = false;
    if (-delta >= 1471228928 - 86400000) { kotlin = detectDiscordKotlin; delta += 1471228928; }
    const absolute = Math.abs(delta), ahead = absolute !== delta, threshold = latency * 1000;
    if (absolute < threshold && !kotlin) return null;
    const duration = absolute >= threshold ? stringDelta(absolute, showMillis) : null;
    const fill = kotlin ? ['status-positive', 'status-positive', 'text-muted'] : delta >= 120000 || ahead ? ['text-muted', 'text-muted', 'text-muted'] :
        delta >= threshold * 2 ? ['status-danger', 'text-muted', 'text-muted'] : ['status-warning', 'status-warning', 'text-muted'];
    const text = duration ? `${ahead ? `This user's clock is ${duration} ahead.` : `This message was sent with a delay of ${duration}.`}${kotlin ? ' User is suspected to be on an old Discord Android client.' : ''}` :
        'User is suspected to be on an old Discord Android client';
    return { duration, fill, text };
}

function Indicator({ message }: { message: Message }) {
    settings.use(['latency', 'detectDiscordKotlin', 'showMillis', 'ignoreSelf']);
    const data = latencyData(message);
    if (!data) return null;
    const icon = (props: Record<string, unknown> = {}) => context.react.createElement('svg', {
        xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 16 16', width: 12, height: 12, role: 'img', fill: 'none',
        style: { marginRight: '8px', verticalAlign: -1 }, 'aria-label': data.duration ?? 'Old Discord Android client', 'aria-hidden': false, ...props
    }, context.react.createElement('title', null, data.text),
    context.react.createElement('path', { fill: `var(--${data.fill[0]})`, d: 'M4.8001 12C4.8001 11.5576 4.51344 11.2 4.16023 11.2H2.23997C1.88676 11.2 1.6001 11.5576 1.6001 12V13.6C1.6001 14.0424 1.88676 14.4 2.23997 14.4H4.15959C4.5128 14.4 4.79946 14.0424 4.79946 13.6L4.8001 12Z' }),
    context.react.createElement('path', { fill: `var(--${data.fill[1]})`, d: 'M9.6001 7.12724C9.6001 6.72504 9.31337 6.39998 8.9601 6.39998H7.0401C6.68684 6.39998 6.40011 6.72504 6.40011 7.12724V13.6727C6.40011 14.0749 6.68684 14.4 7.0401 14.4H8.9601C9.31337 14.4 9.6001 14.0749 9.6001 13.6727V7.12724Z' }),
    context.react.createElement('path', { fill: `var(--${data.fill[2]})`, d: 'M14.4001 2.31109C14.4001 1.91784 14.1134 1.59998 13.7601 1.59998H11.8401C11.4868 1.59998 11.2001 1.91784 11.2001 2.31109V13.6888C11.2001 14.0821 11.4868 14.4 11.8401 14.4H13.7601C14.1134 14.4 14.4001 14.0821 14.4001 13.6888V2.31109Z' }));
    const tooltip = context.webpack.find<{ Tooltip: unknown }>(value => typeof value?.Tooltip === 'function');
    return tooltip ? context.react.createElement(tooltip.Tooltip, { text: data.text, position: 'top', children: icon }) : icon();
}

export function renderIndicator(props: { message: Message }) { return context.react.createElement(Indicator, props); }
