/* Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
let context: RendererContext;
let removeStyle: (() => void) | undefined;
export const React: any = new Proxy({}, { get: (_target, key) => (context.react as any)[key] });
declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } } }
function find(predicate: (value: any) => boolean): any {
    const value = context.webpack.find(predicate);
    if (!value) throw new Error('A Discord module needed by Call Timer has not loaded.');
    return value;
}
function store(name: string): any {
    return new Proxy({}, { get(_target, key) {
        const value = find(value => typeof value?.getName === 'function' && value.getName() === name);
        return typeof value[key] === 'function' ? value[key].bind(value) : value[key];
    } });
}
export const GuildStore = store('GuildStore');
export const UserStore = store('UserStore');
export const FluxDispatcher: any = new Proxy({}, { get(_target, key) {
    const value = find(value => typeof value?.dispatch === 'function' && typeof value?.subscribe === 'function');
    return value[key].bind(value);
} });
export function setContext(ctx: RendererContext): void {
    context = ctx;
    removeStyle = ctx.styles.add('[class*="panels"] [class*="inner"],[class*="rtcConnectionStatus"]{height:fit-content!important}');
}
export function stopContext(): void { removeStyle?.(); removeStyle = undefined; }
export function isActive(): boolean { return !!context && !context.signal.aborted; }
export function useFixedTimer({ initialTime }: { initialTime?: number }): number {
    const [now, setNow] = context.react.useState(Date.now);
    context.react.useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        const dispose = () => clearInterval(timer);
        context.signal.addEventListener('abort', dispose, { once: true });
        return () => { dispose(); context.signal.removeEventListener('abort', dispose); };
    }, []);
    return initialTime == null ? 0 : Math.max(0, now - initialTime);
}
export function formatDurationMs(ms: number, human: boolean = false, seconds: boolean = true) {
    const format = (n: number) => human ? n : n.toString().padStart(2, "0");
    const unit = (s: string) => human ? s : "";
    const delim = human ? " " : ":";

    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor(((ms % 86400000) % 3600000) / 60000);
    const s = Math.floor((((ms % 86400000) % 3600000) % 60000) / 1000);

    let res = "";
    if (d) res += `${d}${unit("d")}${delim}`;
    if (h || res || !seconds) res += `${format(h)}${unit("h")}${delim}`;
    if (m || res || !human || !seconds) res += `${format(m)}${unit("m")}`;
    if (seconds && (m || res || !human)) res += `${delim}`;
    if (seconds) res += `${format(s)}${unit("s")}`;

    return res;
}

export function Tooltip(props: any): any {
    const Native = find(value => typeof value === 'function' && value.prototype?.shouldShowTooltip && value.prototype?.render);
    return React.createElement(Native, props);
}
let Boundary: any;
export const ErrorBoundary: any = Object.assign((props: any) => {
    if (!Boundary) {
        const Base = find(value => typeof value?.Component === 'function' && typeof value?.createElement === 'function').Component;
        Boundary = class extends Base {
            state = { failed: false };
            static getDerivedStateFromError(): { failed: boolean } { return { failed: true }; }
            componentDidCatch(error: unknown): void { context.log.error(error); }
            render(): any { return this.state.failed ? null : this.props.children; }
        };
    }
    return React.createElement(Boundary, props);
}, { wrap: (component: any) => (props: any) => React.createElement(ErrorBoundary, null, React.createElement(component, props)) });
export function normalizePatches(definitions: any[]): SourcePatch[] {
    return definitions.map((patch, index) => ({ id: `call-timer-${index}`, find: patch.find,
        replacement: { match: /^[\s\S]*$/, replace(source: string): string {
            if (patch.predicate?.() === false) return source;
            for (const replacement of Array.isArray(patch.replacement) ? patch.replacement : [patch.replacement]) {
                if (replacement.predicate?.() === false) continue;
                const pattern = replacement.match.source.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)')
                    .replace('#{intl::GUEST_NAME_SUFFIX}', '\\["pFO/Ph"\\]');
                const match = new RegExp(pattern, replacement.match.flags);
                if (!match.test(source)) throw new Error(`Call Timer replacement did not match: ${replacement.match}`);
                source = source.replace(match, replacement.replace.replaceAll('$self', '$self.plugin'));
            }
            return source;
        } }
    }));
}
