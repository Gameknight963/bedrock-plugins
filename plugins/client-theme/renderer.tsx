/* Copyright (c) 2023, 2025 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-21. See NOTICE. */
import type { RendererContext, RendererSettingsContext, RendererSettingsProps, ReactRuntime } from '@bedrock/renderer';
import { relativeLuminance } from './colorUtils.js';
import { createOrUpdateThemeColorVars, startClientTheme, disableClientTheme } from './styleUtils.js';

const defaultColor = '313338';
const colorPresets = [
    '#1E1514', '#172019', '#13171B', '#1C1C28', '#402D2D',
    '#3A483D', '#344242', '#313D4B', '#2D2F47', '#322B42',
    '#3C2E42', '#422938', '#b6908f', '#bfa088', '#d3c77d',
    '#86ac86', '#88aab3', '#8693b5', '#8a89ba', '#ad94bb'
];
let react: ReactRuntime;
const React: ReactRuntime = new Proxy({} as ReactRuntime, { get(_target, key: keyof ReactRuntime) {
    if (key === 'Fragment') return react.Fragment;
    return (...args: unknown[]) => Reflect.apply(react[key] as Function, react, args);
} });
let activation: RendererContext | undefined;
let unsubscribe: (() => void) | undefined;

function readColor(ctx: RendererSettingsContext): string {
    const color = ctx.settings.get('color', defaultColor);
    return typeof color === 'string' && /^[0-9a-f]{6}$/i.test(color) ? color : defaultColor;
}
function useStore(ctx: RendererSettingsContext, name: string, getValue: (store: any) => any): any {
    const store = ctx.webpack.find<any>(value => value?.getName?.() === name);
    if (!store) throw new Error(`Discord's ${name} is not available.`);
    const [, refresh] = React.useState(0);
    React.useEffect(() => {
        const update = () => refresh(value => value + 1);
        store.addChangeListener(update);
        return () => store.removeChangeListener(update);
    }, [store]);
    return getValue(store);
}
function Paragraph({ children }: any): any {
    return <p style={{ fontFamily: 'var(--font-primary)', fontSize: '14px', lineHeight: '1.28571', fontWeight: 400, margin: 0, color: 'var(--text-default)' }}>{children}</p>;
}
function Button({ danger = false, children, ...props }: any): any {
    return <button {...props} data-mana-component="button" className={`vc-btn-base vc-btn-${danger ? 'dangerPrimary' : 'primary'} vc-btn-medium`}>{children}</button>;
}
async function loadStyles(ctx: RendererSettingsContext): Promise<void> {
    const response = await fetch(new URL('./styles.css', import.meta.url), { signal: ctx.signal });
    if (!response.ok) throw new Error(`Could not load Client Theme settings styles (HTTP ${response.status}).`);
    const css = await response.text();
    if (!ctx.signal.aborted) ctx.styles.add(css);
}

export function Settings({ ctx }: RendererSettingsProps): any {
    react = ctx.react;
    const [color, setColor] = React.useState(() => readColor(ctx));
    const [error, setError] = React.useState('');
    const pending = React.useRef<string | undefined>(undefined);
    const currentTheme = useStore(ctx, 'ThemeStore', store => store.theme);
    const nitroThemeEnabled = useStore(ctx, 'ClientThemesBackgroundStore', store => store.gradientPreset != null);
    const isLightTheme = currentTheme === 'light';
    const oppositeTheme = isLightTheme ? 'Dark' : 'Light';
    const luminance = relativeLuminance(color);
    const contrastWarning = isLightTheme ? luminance < 0.26 || luminance > 0.65 : luminance > 0.12;
    const fixableContrast = !(luminance > 0.12 && luminance < 0.26) && !(isLightTheme && luminance > 0.65);
    const ColorPicker = ctx.components.ColorPicker;
    React.useEffect(() => {
        void loadStyles(ctx).catch(error => { if (!ctx.signal.aborted) setError(error instanceof Error ? error.message : String(error)); });
        return ctx.events.on('settings.changed', event => {
            if (event.id === ctx.id) setColor(pending.current ?? readColor(ctx));
        });
    }, [ctx]);
    const pick = (value: number) => {
        if (ctx.signal.aborted || !Number.isInteger(value) || value < 0 || value > 0xffffff) return;
        const next = value.toString(16).padStart(6, '0');
        pending.current = next;
        setColor(next); setError('');
        if (activation && !activation.signal.aborted) createOrUpdateThemeColorVars(next);
        void ctx.settings.set('color', next).catch(error => {
            if (ctx.signal.aborted || pending.current !== next) return;
            const saved = readColor(ctx); setColor(saved);
            if (activation && !activation.signal.aborted) createOrUpdateThemeColorVars(saved);
            ctx.log.error('Could not save the theme color.', error);
            setError(error instanceof Error ? error.message : String(error));
        }).finally(() => { if (pending.current === next) pending.current = undefined; });
    };
    const setDiscordTheme = (theme: string) => {
        if (ctx.signal.aborted) return;
        const update = ctx.webpack.find<any>(value => typeof value === 'function' && String(value).includes('type:"UNSYNCED_USER_SETTINGS_UPDATE') && String(value).includes('"system"==='));
        if (!update) { setError("Discord's theme settings action is not available."); return; }
        try {
            Promise.resolve(update({ theme: theme.toLowerCase() })).catch(error => {
                if (!ctx.signal.aborted) { ctx.log.error('Could not change Discord\'s theme.', error); setError(error instanceof Error ? error.message : String(error)); }
            });
        } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    };
    return <>
        {error && <p role="alert" className="bedrock-error">{error}</p>}
        <div className="vc-clientTheme-settings">
            <div className="vc-clientTheme-container">
                <div className="vc-clientTheme-settings-labels">
                    <h3 className="vc-h3 vc-h3-defaultMargin">Theme Color</h3>
                    <Paragraph>Add a color to your Discord client theme</Paragraph>
                </div>
                <ColorPicker color={parseInt(color, 16)} onChange={pick} showEyeDropper={false} suggestedColors={colorPresets} />
            </div>
            {(contrastWarning || nitroThemeEnabled) && <div className="vc-error-card" style={{ marginTop: 8 }}>
                <h2 className="vc-h2 vc-h2-defaultMargin">Your theme won't look good!</h2>
                {contrastWarning && <Paragraph>{'>'} Selected color won't contrast well with text</Paragraph>}
                {nitroThemeEnabled && <Paragraph>{'>'} Nitro themes aren't supported</Paragraph>}
                <div className="vc-clientTheme-buttons-container">
                    {contrastWarning && fixableContrast && <Button danger onClick={() => setDiscordTheme(oppositeTheme)}>Switch to {oppositeTheme} mode</Button>}
                    {nitroThemeEnabled && <Button danger onClick={() => setDiscordTheme(currentTheme)}>Disable Nitro Theme</Button>}
                </div>
            </div>}
        </div>
        <Button onClick={() => pick(0x313338)}>Reset Theme Color</Button>
    </>;
}

export async function start(ctx: RendererContext): Promise<void> {
    activation = ctx;
    await startClientTheme(ctx, readColor(ctx));
    if (ctx.signal.aborted || activation !== ctx) return;
    unsubscribe = ctx.events.on('settings.changed', event => {
        if (event.id === ctx.id && activation === ctx && !ctx.signal.aborted) createOrUpdateThemeColorVars(readColor(ctx));
    });
}
export function stop(): void {
    unsubscribe?.(); unsubscribe = undefined;
    activation = undefined;
    disableClientTheme();
}
declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } interface IntrinsicAttributes { key?: string | number } } }
