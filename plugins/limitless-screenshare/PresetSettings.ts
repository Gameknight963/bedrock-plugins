/* Copyright (c) 2026 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererSettingsProps } from '@bedrock/renderer';
import { defaultFrameRates, defaultResolutions, readPresets, type Preset } from './discord.js';

export function Settings({ ctx }: RendererSettingsProps): any {
    const React = ctx.react;
    const [resolutions, setResolutions] = React.useState(() => readPresets(ctx.settings.get('resolutions', defaultResolutions), defaultResolutions));
    const [fpss, setFpss] = React.useState(() => readPresets(ctx.settings.get('fpss', defaultFrameRates), defaultFrameRates));
    const [resolutionInput, setResolutionInput] = React.useState('');
    const [fpsInput, setFpsInput] = React.useState('');
    const [error, setError] = React.useState('');
    const saves = React.useRef(Promise.resolve());
    React.useEffect(() => ctx.styles.add(`
        .vc-limitlessScreenshare-presets { display:flex; gap:.5em; flex-wrap:wrap; margin:8px 0 20px; }
        .vc-limitlessScreenshare-preset { display:flex; align-items:center; gap:.5em; padding:4px; border-radius:8px;
            border:1px solid var(--border-subtle); background:var(--background-surface-high,var(--background-secondary)); }
        .vc-limitlessScreenshare-preset span { padding-left:.5em; font-size:14px; font-weight:600; }
        .vc-limitlessScreenshare-preset input { width:5em; height:28px; box-sizing:border-box; background:var(--input-background,var(--background-tertiary));
            color:var(--text-default); border:1px solid var(--border-subtle); border-radius:4px; padding:4px 6px; font:inherit; }
        .vc-limitlessScreenshare-preset button { display:flex; align-items:center; justify-content:center; border:0; border-radius:4px;
            height:28px; width:28px; cursor:pointer; color:var(--text-default); background:var(--button-secondary-background,var(--background-modifier-hover)); }
        .vc-limitlessScreenshare-preset button[data-delete] { color:var(--text-danger,var(--status-danger)); }
        .vc-limitlessScreenshare-preset button:disabled { opacity:.4; cursor:default; }
        .vc-limitlessScreenshare-error { color:var(--text-danger,var(--status-danger)); font-size:12px; }
    `), [ctx]);
    function save(key: string, list: Preset[]): void {
        if (key === 'resolutions') setResolutions(list); else setFpss(list);
        saves.current = saves.current.catch(() => {}).then(() => {
            if (!ctx.signal.aborted) return ctx.settings.set(key, list);
        }).catch(reason => {
            if (!ctx.signal.aborted) { ctx.log.error(reason); setError(reason instanceof Error ? reason.message : String(reason)); }
        });
    }
    function icon(deleteIcon: boolean): any {
        return React.createElement('svg', { width:20,height:20,viewBox:'0 0 24 24',fill:'currentColor','aria-hidden':true },
            React.createElement('path', { d:deleteIcon ? 'M5 6h14l-1 15H6L5 6Zm3-3h8l1 2H7l1-2Z' : 'M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4Z' }));
    }
    function list(isResolution: boolean): any {
        const presets = isResolution ? resolutions : fpss;
        const input = isResolution ? resolutionInput : fpsInput;
        const setInput = isResolution ? setResolutionInput : setFpsInput;
        const value = Number(input);
        const valid = !!input && Number.isInteger(value) && value >= (isResolution ? 3 : 1);
        const key = isResolution ? 'resolutions' : 'fpss';
        return React.createElement('section', null,
            React.createElement('h3', { style:{fontSize:16, fontWeight:600, marginBottom:8} }, isResolution ? 'Resolution presets' : 'Frame-rate presets'),
            React.createElement('div', { className:'vc-limitlessScreenshare-presets' },
                ...presets.map((preset,index) => React.createElement('div', { key:index,className:'vc-limitlessScreenshare-preset' },
                    React.createElement('span', null,preset.label), React.createElement('button', { type:'button','data-delete':true,'aria-label':`Delete ${preset.label}`,
                        disabled:isResolution && preset.value === 0, onClick:()=>save(key,presets.filter((_preset,itemIndex)=>itemIndex!==index)) },icon(true)))),
                React.createElement('div', { className:'vc-limitlessScreenshare-preset' },
                    React.createElement('input', { type:'number',min:isResolution?3:1,step:1,value:input,'aria-label':isResolution?'New resolution':'New frame rate',onChange:(event:Event)=>setInput((event.target as HTMLInputElement).value) }),
                    React.createElement('button', { type:'button',disabled:!valid,'aria-label':'Add preset',onClick:()=>{
                        if (!valid) return;
                        save(key,[...presets,{label:`${value}${isResolution?'p':'fps'}`,value}].sort((a,b)=>Number(!a.value)-Number(!b.value)||a.value-b.value));
                        setInput('');
                    } },icon(false)))));
    }
    return React.createElement('div', null,list(false),list(true),error && React.createElement('p',{className:'vc-limitlessScreenshare-error',role:'alert'},error));
}
