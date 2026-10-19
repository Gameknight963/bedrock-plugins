/* Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
let context: RendererContext | undefined;
export const patches: SourcePatch[] = [{ id: 'reply-preview-timestamp', find: '["1i+hMi"]', replacement: {
    match: new RegExp(String.raw`\.onClickReply,.+?}\),(?=\i,\i,\i\])`.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)')),
    replace: '$&$self.ReplyTimestamp(arguments[0]),'
} }];
function find(predicate: (value: any) => boolean, name: string): any {
    const value = context!.webpack.find(predicate);
    if (!value) throw new Error(`Discord's ${name} is not available.`);
    return value;
}
export function ReplyTimestamp({ referencedMessage, baseMessage }: any): any {
    if (!context || context.signal.aborted || referencedMessage?.state !== 0) return null;
    try {
        const { react } = context;
        const timestamp = referencedMessage.message.timestamp, base = baseMessage.timestamp;
        const isSameDay = find(value => typeof value === 'function' && /Math\.abs\([A-Za-z_$][\w$]*-[A-Za-z_$][\w$]*\)/.test(String(value)) && String(value).includes('864e5'), 'same-day comparison');
        const sameDay = isSameDay(timestamp, base);
        const formatter = find(value => typeof value === 'function' && String(value).includes(sameDay ? '<2?"nextDay":"sameElse";' : '<-1?"sameElse":'), 'date formatter');
        const Timestamp = find(value => {
            const component = value?.type || value?.render || value;
            return typeof component === 'function' && String(component).includes('CDzOFd');
        }, 'timestamp component');
        const classes = find(value => typeof value?.separator === 'string' && typeof value?.latin24CompactTimeStamp === 'string', 'timestamp styles');
        return react.createElement(Timestamp, { className: 'vc-reply-timestamp', compact: sameDay, timestamp, isInline: false },
            react.createElement('i', { className: classes.separator, 'aria-hidden': true }, '['),
            sameDay ? formatter(timestamp, 'LT') : formatter(timestamp),
            react.createElement('i', { className: classes.separator, 'aria-hidden': true }, ']'));
    } catch (error) { context.log.error('Could not display the reply timestamp.', error); return null; }
}
export function start(ctx: RendererContext): void {
    context = ctx;
    ctx.styles.add('.vc-reply-timestamp{margin-inline-end:0.5rem;width:unset!important}');
}
export function stop(): void { context = undefined; }
