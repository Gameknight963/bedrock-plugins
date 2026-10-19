/* Copyright (c) 2023-2026 Vendicated and Bedrock contributors. SPDX-License-Identifier: GPL-3.0-or-later */
import type { ReactRuntime, RendererSettingsContext } from '@bedrock/renderer';
let runtime: ReactRuntime;
let UiContext: any;
export function setReact(react: ReactRuntime): void { runtime = react; }
export const React: ReactRuntime = new Proxy({} as ReactRuntime, { get(_target, key: keyof ReactRuntime) {
    if (key === 'Fragment') return runtime.Fragment;
    return (...args: unknown[]) => Reflect.apply(runtime[key] as Function, runtime, args);
} });
export const useState = React.useState;
export const classNameFactory = (prefix: string) => (...names: string[]) => names.map(name => prefix + name).join(' ');
export function UiProvider({ ctx, children }: any): any {
    UiContext ||= (runtime as any).createContext(null);
    return React.createElement(UiContext.Provider, { value: ctx }, children);
}
function useContext(): RendererSettingsContext { return (runtime as any).useContext(UiContext); }
function useNative(name: string, ...parts: string[]): any {
    const ctx = useContext();
    const component = ctx.webpack.find(value => {
        const fn = value?.type || value?.render || value;
        return typeof fn === 'function' && parts.every(part => String(fn).includes(part));
    });
    if (!component) throw new Error(`Discord's ${name} is not available.`);
    return component;
}
export function TextInput({ editable = true, ...props }: any): any {
    return React.createElement(useNative('text input', 'setHasValue?.(""!==', '="text",'), { ...props, readOnly: !editable });
}
export function Select(props: any): any {
    return React.createElement(useNative('select', 'selectionMode:"single",onSelectionChange:', 'isSelected:'), props);
}
export function TooltipContainer({ children, ...props }: any): any {
    const ctx = useContext();
    const Tooltip = ctx.webpack.find(value => typeof value === 'function' && value.prototype?.shouldShowTooltip && value.prototype?.render);
    if (!Tooltip) throw new Error("Discord's tooltip is not available.");
    return React.createElement(Tooltip, { ...props, children: (tooltipProps: any) => <div {...tooltipProps}>{children}</div> });
}
export function Button({ variant = 'primary', size = 'medium', children, className = '', ...props }: any): any {
    return <button type="button" data-mana-component="button" className={`vc-btn-base vc-btn-${variant} vc-btn-${size} ${className}`} {...props}>{children}</button>;
}
export function Flex({ flexDirection = 'row', gap = '1em', children, style, ...props }: any): any {
    return <div {...props} style={{ display: 'flex', flexDirection, gap, ...style }}>{children}</div>;
}
export function HeadingSecondary({ children }: any): any { return <h3 className="vc-h3 vc-h3-defaultMargin">{children}</h3>; }
function Text({ tag, size, weight, children, ...props }: any): any {
    const dimensions: Record<string, { fontSize: string; lineHeight: string }> = { sm: { fontSize: '14px', lineHeight: '1.28571' }, md: { fontSize: '16px', lineHeight: '1.25' } };
    const weights: Record<string, number> = { normal: 400, medium: 500, semibold: 600 };
    return React.createElement(tag, { ...props, className: 'vc-text-base vc-text-defaultColor', style: { ...dimensions[size], fontWeight: weights[weight] } }, children);
}
export const Paragraph = ({ size = 'sm', weight = 'normal', ...props }: any): any => <Text tag="p" size={size} weight={weight} {...props} />;
export const Span = ({ size = 'sm', weight = 'normal', ...props }: any): any => <Text tag="span" size={size} weight={weight} {...props} />;
export function ExpandableSection({ children, renderContent: Content, initialExpanded = false }: any): any {
    const [expanded, setExpanded] = React.useState<boolean>(initialExpanded);
    const Clickable = useNative('clickable', 'this.context?this.renderNonInteractive():');
    return <div className="vc-card-base vc-card-primary vc-expandable-card" data-expanded={expanded}>
        <Clickable className="vc-expandable-card-header" onClick={() => setExpanded(value => !value)}>
            {children}<svg className="vc-expandable-card-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d={expanded ? 'm5.3 9.3 6 6a1 1 0 0 0 1.4 0l6-6a1 1 0 1 0-1.4-1.4L12 13.2 6.7 7.9a1 1 0 1 0-1.4 1.4Z' : 'M9.3 5.3a1 1 0 0 0 0 1.4l5.3 5.3-5.3 5.3a1 1 0 0 0 1.4 1.4l6-6a1 1 0 0 0 0-1.4l-6-6a1 1 0 0 0-1.4 0Z'} />
            </svg>
        </Clickable>
        {expanded && <div className="vc-expandable-card-content"><Content /></div>}
    </div>;
}
export function loadStyles(ctx: RendererSettingsContext): void {
    void fetch(new URL('./styles.css', import.meta.url), { signal: ctx.signal }).then(response => {
        if (!response.ok) throw new Error(`Could not load Text Replace styles (HTTP ${response.status}).`);
        return response.text();
    }).then(css => { if (!ctx.signal.aborted) ctx.styles.add(css); }).catch(error => { if (!ctx.signal.aborted) ctx.log.error(error); });
}
