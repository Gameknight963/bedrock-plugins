/* Copyright (c) 2022, 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-21. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
interface NativeNotices {
    show(type: string, message: string, button: string, callback: () => void, id: string): void;
    dismiss(options: { id: string }): void;
}
interface NoticeStore {
    getNotice(): { id?: string } | null;
    hasNotice(): boolean;
    addChangeListener(callback: () => void): void;
    removeChangeListener(callback: () => void): void;
}
const noticeId = 'BedrockRelationshipNotifier';
let context: RendererContext;
let notices: NativeNotices | undefined;
let store: NoticeStore | undefined;
let running = false;
let lifecycle = 0;
let scheduled = false;
let active: string | undefined;
const queue: string[] = [];
function pump(): void {
    scheduled = false;
    if (!running || context.signal.aborted || !notices || !store) return;
    const current = store.getNotice();
    if (current || store.hasNotice()) return;
    active ??= queue.shift();
    if (active !== undefined) notices.show('GENERIC', active, 'OK', () => notices?.dismiss({ id: noticeId }), noticeId);
}
function schedule(): void {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(pump);
}
export function noticeHasCurrent(current: { id?: string } | null): boolean {
    return running && !context.signal.aborted && active !== undefined && current?.id === noticeId;
}
export function noticeDismissed(): void { active = undefined; schedule(); }
export function enqueueNotice(message: string): void { queue.push(message); schedule(); }
export function clearNotices(): void {
    queue.length = 0; active = undefined;
    notices?.dismiss({ id: noticeId });
}
export async function startNotices(ctx: RendererContext): Promise<void> {
    context = ctx;
    const token = ++lifecycle;
    const [native, nativeStore] = await Promise.all([
        ctx.webpack.waitFor<NativeNotices>(value => typeof value?.show === 'function' && typeof value?.dismiss === 'function' && !value?.suppressAll),
        ctx.webpack.waitFor<NoticeStore>(value => typeof value?.getNotice === 'function' && typeof value?.hasNotice === 'function' && typeof value?.isNoticeDismissed === 'function')
    ]);
    if (ctx.signal.aborted || token !== lifecycle) return;
    notices = native; store = nativeStore; running = true;
    store.addChangeListener(schedule);
}
export function stopNotices(): void {
    running = false; lifecycle++;
    store?.removeChangeListener(schedule);
    clearNotices();
    store = undefined; notices = undefined;
}
const re = (source: string, flags?: string) => new RegExp(source.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)'), flags);
export const noticePatches: SourcePatch[] = [{ id: 'persistent-relationship-notices', find: '"NoticeStore"', replacement: [
    { match: re(String.raw`(?<=!1;)(?=(?:if\(.+?\)return false;)*(\i)=null;(?=.{0,80}getPremiumSubscription\(\)))`, 'g'),
        replace: (_match: string, notice: string) => `if($self.noticeHasCurrent(${notice}))return false;` },
    { match: re(String.raw`(?<=,NOTICE_DISMISS:function\(\i\){)(?=.{0,1400}?return null!=(\i))`),
        replace: (_match: string, notice: string) => `if(${notice}?.id==="${noticeId}"&&(arguments[0].id==null||arguments[0].id==="${noticeId}"))return(${notice}=null,$self.noticeDismissed(),true);` }
] }];
