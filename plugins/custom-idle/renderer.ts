/* Copyright (c) 2022, 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';

export const settings = Bedrock.definePluginSettings({
    idleTimeout: { type: Bedrock.OptionType.SLIDER, label: 'Idle timeout', description: 'Minutes before Discord goes idle. Set to zero to disable automatic idle.', default: 10, min: 0, max: 60, step: 1, restartNeeded: true },
    remainInIdle: { type: Bedrock.OptionType.BOOLEAN, label: 'Remain idle on return', description: 'Wait for you to choose Exit idle before returning online.', default: true }
});

interface Dispatcher { dispatch(event: { type: string; idle: boolean }): void }
interface Notices {
    show(type: string, message: string, buttonText: string, callback: () => void, id: string): void;
    dismiss(options: { id: string }): void;
}
interface NoticeStore { getNotice(): { id?: string } | null; hasNotice(): boolean }
const noticeId = 'BedrockCustomIdleNotice';
const message = 'Welcome back! Click the button to go online. Click the X to stay idle until reload.';
let context: RendererContext;
let dispatcher: Dispatcher | undefined;
let notices: Notices | undefined;
let noticeStore: NoticeStore | undefined;
let noticeActive = false;
let stayIdle = false;
let unsubscribe: (() => void) | undefined;

export function hasNotice(current?: { id?: string } | null): boolean {
    return noticeActive && !!context && !context.signal.aborted && (!arguments.length || current?.id === noticeId);
}
export function noticeDismissed(): void {
    if (noticeActive) stayIdle = true;
    noticeActive = false;
}
function dismissNotice(): void {
    if (!noticeActive) return;
    noticeActive = false;
    notices?.dismiss({ id: noticeId });
}
function goOnline(): void {
    dismissNotice();
    stayIdle = false;
    dispatcher?.dispatch({ type: 'IDLE', idle: false });
}
export function handleOnline(): void {
    if (!context || context.signal.aborted || !settings.store.remainInIdle) { goOnline(); return; }
    if (stayIdle) return;
    if (!notices) return;
    const current = noticeStore?.getNotice();
    if (noticeActive && current?.id === noticeId) return;
    if (current && current.id !== noticeId || !current && noticeStore?.hasNotice()) return;
    noticeActive = true;
    notices.show('GENERIC', message, 'Exit idle', goOnline, noticeId);
}
export function getIdleTimeout(): number {
    if (context?.signal.aborted) return 600000;
    return settings.store.idleTimeout === 0 ? Infinity : settings.store.idleTimeout * 60000;
}

const identifier = '(?:[A-Za-z_$][\\w$]*)';
const re = (source: string, flags?: string) => new RegExp(source.replaceAll('\\i', identifier), flags);
export const patches: SourcePatch[] = [{
    id: 'idle-timeout-and-return', find: 'type:"IDLE",idle:', replacement: [
        { match: re(String.raw`(?<=Date\.now\(\)-\i>)\i\.\i\|\|`), replace: '$self.getIdleTimeout()||' },
        { match: re(String.raw`Math\.min\((\i\*\i\.\i\.\i\.SECOND),\i\.\i\)`), replace: '$1' },
        { match: re(String.raw`\i\.\i\.dispatch\({type:"IDLE",idle:!1}\)`), replace: '$self.handleOnline()' }
    ]
}, {
    id: 'persistent-idle-notice', find: '"NoticeStore"', replacement: [
        { match: re(String.raw`(?<=!1;)(?=(?:if\(.+?\)return false;)*(\i)=null;(?=.{0,80}getPremiumSubscription\(\)))`, 'g'),
            replace: (_match: string, notice: string) => `if($self.hasNotice(${notice}))return false;` },
        { match: re(String.raw`(?<=,NOTICE_DISMISS:function\(\i\){)(?=.{0,1400}?return null!=(\i))`),
            replace: (_match: string, notice: string) => `if(${notice}?.id==="${noticeId}"&&(arguments[0].id==null||arguments[0].id==="${noticeId}"))return(${notice}=null,$self.noticeDismissed(),true);` }
    ]
}];

export async function start(ctx: RendererContext): Promise<void> {
    context = ctx; noticeActive = false; stayIdle = false;
    const [events, nativeNotices, nativeStore] = await Promise.all([
        ctx.webpack.waitFor<Dispatcher>(value => typeof value?.dispatch === 'function' && typeof value?.subscribe === 'function'),
        ctx.webpack.waitFor<Notices>(value => typeof value?.show === 'function' && typeof value?.dismiss === 'function' && !value?.suppressAll),
        ctx.webpack.waitFor<NoticeStore>(value => typeof value?.getNotice === 'function' && typeof value?.hasNotice === 'function' && typeof value?.isNoticeDismissed === 'function')
    ]);
    if (ctx.signal.aborted) return;
    dispatcher = events; notices = nativeNotices; noticeStore = nativeStore;
    unsubscribe = settings.subscribe(key => { if (key === 'remainInIdle' && !settings.store.remainInIdle) goOnline(); });
}
export function stop(): void {
    unsubscribe?.(); unsubscribe = undefined;
    dismissNotice(); stayIdle = false;
}
