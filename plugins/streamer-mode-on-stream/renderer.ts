/* Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext } from '@bedrock/renderer';
type Dispatcher = { dispatch(event: Record<string, unknown>): void; subscribe(name: string, callback: (event: StreamEvent) => void): void; unsubscribe(name: string, callback: (event: StreamEvent) => void): void };
interface StreamEvent { streamKey: string }
let context: RendererContext;
let dispatcher: Dispatcher | undefined;
let userStore: { getCurrentUser(): { id: string } | undefined } | undefined;
function toggle({ streamKey }: StreamEvent, value: boolean): void {
    if (context.signal.aborted) return;
    const id = userStore?.getCurrentUser()?.id;
    if (!id || typeof streamKey !== 'string' || !streamKey.endsWith(`:${id}`)) return;
    dispatcher?.dispatch({ type: 'STREAMER_MODE_UPDATE', key: 'enabled', value });
}
const created = (event: StreamEvent) => toggle(event, true);
const deleted = (event: StreamEvent) => toggle(event, false);
export async function start(ctx: RendererContext): Promise<void> {
    context = ctx;
    const [events, users] = await Promise.all([
        ctx.webpack.waitFor<Dispatcher>(value => typeof value?.dispatch === 'function' && typeof value?.subscribe === 'function'),
        ctx.webpack.waitFor<typeof userStore>(value => typeof value?.getCurrentUser === 'function' && typeof value?.getUser === 'function')
    ]);
    if (ctx.signal.aborted) return;
    dispatcher = events; userStore = users;
    events.subscribe('STREAM_CREATE', created);
    events.subscribe('STREAM_DELETE', deleted);
}
export function stop(): void {
    dispatcher?.unsubscribe('STREAM_CREATE', created);
    dispatcher?.unsubscribe('STREAM_DELETE', deleted);
    dispatcher = undefined; userStore = undefined;
}
