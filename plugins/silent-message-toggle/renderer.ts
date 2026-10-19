/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { ChatBarProps, MenuElement, RendererContext } from '@bedrock/renderer';
let context: RendererContext;
let enabled = false;
const listeners = new Set<() => void>();
const disposers: Array<() => void> = [];
export const settings = Bedrock.definePluginSettings({
    persistState: { type: Bedrock.OptionType.SELECT, label: 'Remember toggle state', default: 'none', options: [
        { label: "Don't persist (reset on channel change)", value: 'none' },
        { label: 'Persist between channels', value: 'channels' },
        { label: 'Persist between channels and restarts', value: 'restarts' }] },
    autoDisable: { type: Bedrock.OptionType.BOOLEAN, label: 'Turn off after sending', description: 'Automatically turn off silent messages after sending one.', default: true }
});
export function setEnabled(value: boolean): void {
    enabled = value;
    for (const listener of listeners) listener();
    const activation = context;
    if (settings.store.persistState === 'restarts') void activation.settings.set('silentEnabled', value).catch(error => activation.log.error('Could not save the silent message toggle.', error));
}
function Icon({ on }: { on: boolean }): MenuElement {
    const React = context.react;
    return React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', style: { scale: '1.2' }, 'aria-hidden': true },
        !on && React.createElement('mask', { id: 'bedrock-silent-msg-mask' }, React.createElement('path', { fill: '#fff', d: 'M0 0h24v24H0Z' }), React.createElement('path', { stroke: '#000', strokeWidth: 5.99068, d: 'M0 24 24 0' })),
        React.createElement('path', { fill: 'currentColor', mask: on ? undefined : 'url(#bedrock-silent-msg-mask)', d: 'M18 10.7101C15.1085 9.84957 13 7.17102 13 4c0-.30736.0198-.6101.0582-.907C12.7147 3.03189 12.3611 3 12 3 8.686 3 6 5.686 6 9v5c0 1.657-1.344 3-3 3v1h18v-1c-1.656 0-3-1.343-3-3v-3.2899ZM8.55493 19c.693 1.19 1.96897 2 3.44497 2s2.752-.81 3.445-2H8.55493ZM18.2624 5.50209 21 2.5V1h-4.9651v1.49791h2.4411L16 5.61088V7h5V5.50209h-2.7376Z' }),
        !on && React.createElement('path', { fill: 'var(--status-danger)', d: 'm21.178 1.70703 1.414 1.414L4.12103 21.593l-1.414-1.415L21.178 1.70703Z' }));
}
function Button(props: ChatBarProps): MenuElement | null {
    const activation = context, React = activation.react;
    const state = React.useSyncExternalStore(callback => { listeners.add(callback); return () => listeners.delete(callback); }, () => enabled);
    if (props.isMainChat === false) return null;
    return activation.chatBar.button({ label: state ? 'Disable Silent Message' : 'Enable Silent Message', pressed: state,
        icon: React.createElement(Icon, { on: state }), onClick: () => setEnabled(!enabled) });
}
export async function start(ctx: RendererContext): Promise<void> {
    context = ctx;
    enabled = settings.store.persistState === 'restarts' && ctx.settings.get<boolean>('silentEnabled', false) === true;
    const flux = await ctx.webpack.waitFor<{ subscribe(name: string, callback: () => void): void; unsubscribe(name: string, callback: () => void): void }>(value => typeof value?.dispatch === 'function' && typeof value?.subscribe === 'function');
    if (ctx.signal.aborted) return;
    const channelChanged = () => { if (settings.store.persistState === 'none') setEnabled(false); };
    flux.subscribe('CHANNEL_SELECT', channelChanged); disposers.push(() => flux.unsubscribe('CHANNEL_SELECT', channelChanged));
    disposers.push(settings.subscribe(key => {
        if (key !== 'persistState') return;
        if (settings.store.persistState === 'none') setEnabled(false);
        if (settings.store.persistState === 'restarts') setEnabled(enabled);
    }));
    ctx.messages.beforeSend(event => {
        if (!enabled) return;
        if (!event.message.content.startsWith('@silent ')) event.message.content = `@silent ${event.message.content}`;
        if (settings.store.autoDisable) setEnabled(false);
    });
    ctx.chatBar.addButton('silent-message-toggle', props => ctx.react.createElement(Button, props as unknown as Record<string, unknown>));
}
export function stop(): void { for (const dispose of disposers.splice(0)) dispose(); enabled = false; listeners.clear(); }
