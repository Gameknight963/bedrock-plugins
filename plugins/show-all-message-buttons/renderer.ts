/* Copyright (c) 2025 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
let context: RendererContext | undefined;
const identifier = '[A-Za-z_$][\\w$]*';
const re = (source: string) => new RegExp(source.replaceAll('\\i', identifier));
export const settings = Bedrock.definePluginSettings({
    noShiftDelete: { type: Bedrock.OptionType.BOOLEAN, label: 'Delete without Shift', description: 'Delete immediately when clicking the delete button, without holding Shift.', default: true },
    noShiftPin: { type: Bedrock.OptionType.BOOLEAN, label: 'Pin without Shift', description: 'Pin or unpin immediately without holding Shift.', default: true },
    noQuickReacts: { type: Bedrock.OptionType.BOOLEAN, label: 'Hide quick reactions', description: 'Hide the quick reaction buttons when showing the full message toolbar.', default: true }
});
export const patches: SourcePatch[] = [{ id: 'expanded-message-toolbar', find: 'Lv7LxN),children', replacement: [
    { match: re(String.raw`isExpanded:(\i)&&(.+?),`), replace: 'isExpanded:$self.expandButtons($1,$2),' },
    { match: /onClick:(.{10,20})(?=,dangerous:!0)/, replace: 'onClick:event=>$self.deleteMessage(event,arguments[0].message,$1)' },
    { match: /onClick:(.{10,30})(?=\},"pin")/, replace: 'onClick:event=>$self.toggleMessagePin(event,arguments[0],$1)' },
    { match: re(String.raw`(\i)(\?null:\(0,\i\.jsxs\).{0,100}message:\i\}\)),\(0,\i\.jsxs?\)\(\i\.\i,\{\}\)`),
        replace: (match: string, condition: string) => `$self.hideQuickReactions(${condition})${match.slice(condition.length)}` }
] }];
export function expandButtons(shift: boolean, available: boolean): boolean {
    settings.use(['noShiftDelete', 'noShiftPin', 'noQuickReacts']);
    return context && !context.signal.aborted ? available : shift && available;
}
export function hideQuickReactions(original: boolean): boolean { return context && !context.signal.aborted ? settings.store.noQuickReacts : original; }
async function run(action: () => unknown): Promise<void> {
    const activation = context;
    try { await action(); } catch (error) { if (activation && !activation.signal.aborted) activation.notifications.show({ title: 'Could not run this message action.', body: error instanceof Error ? error.message : String(error), type: 'error' }); }
}
export function deleteMessage(event: unknown, message: { channel_id: string; id: string }, original: (event: unknown) => unknown): unknown {
    if (!context || context.signal.aborted || !settings.store.noShiftDelete) return original(event);
    const activation = context;
    return run(() => {
        const actions = activation.webpack.find<{ deleteMessage(channel: string, message: string): unknown }>(value => typeof value?.deleteMessage === 'function' && typeof value?.sendMessage === 'function');
        if (!actions) throw new Error('Discord message actions are not available.');
        return actions.deleteMessage(message.channel_id, message.id);
    });
}
export function toggleMessagePin(event: unknown, { channel, message }: { channel: unknown; message: { id: string; pinned: boolean } }, original: (event: unknown) => unknown): unknown {
    if (!context || context.signal.aborted || !settings.store.noShiftPin) return original(event);
    const activation = context;
    return run(() => {
        const actions = activation.webpack.find<{ pinMessage(channel: unknown, message: string): unknown; unpinMessage(channel: unknown, message: string): unknown }>(value => typeof value?.pinMessage === 'function' && typeof value?.unpinMessage === 'function');
        if (!actions) throw new Error('Discord pin actions are not available.');
        return message.pinned ? actions.unpinMessage(channel, message.id) : actions.pinMessage(channel, message.id);
    });
}
export function start(ctx: RendererContext): void { context = ctx; }
export function stop(): void { context = undefined; }
