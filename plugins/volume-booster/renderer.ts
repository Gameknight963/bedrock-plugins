/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import type { SourcePatch } from '@bedrock/renderer';
const { definePluginSettings, OptionType } = Bedrock;
export const settings = definePluginSettings({
    multiplier: {
        label: "Volume multiplier",
        description: "Multiply the usual maximum volume by this amount.",
        type: OptionType.SLIDER,
        min: 1, max: 5, step: 0.5,
        default: 2,
    }
});

export const plugin = {
    name: "VolumeBooster",
    description: "Allows you to set the user and stream volume above the default maximum",
    settings,

    patches: [
        // Change the max volume for sliders to allow for values above 200
        {
            find: "#{intl::USER_VOLUME}",
            replacement: {
                match: /(?<=maxValue:)\i\.isPlatformEmbedded\?(\i\.\i):\i\.\i(?=,)/,
                replace: (_: string, higherMaxVolume: string) => `${higherMaxVolume}*$self.settings.store.multiplier`
            }
        },
        // Change the max volume for sliders to allow for values above 200
        {
            find: "currentVolume:",
            replacement: {
                match: /(?<=maxValue:)\i\.\i\?(\d+?):\d+?(?=,)/,
                replace: (_: string, higherMaxVolume: string) => `${higherMaxVolume}*$self.settings.store.multiplier`
            }
        },
        // Prevent Audio Context Settings sync from trying to sync with values above 200, changing them to 200 before we send to Discord
        {
            find: "AudioContextSettingsMigrated",
            replacement: [
                {
                    match: /(?<=isLocalMute\(\i,\i\),volume:(\i).+?\(0,\i\.\i\)\(\i,\i,\{volume:)\1(?=\}\))/,
                    replace: "$&>200?200:$&"
                },
                {
                    match: /(?<=Object\.entries\(\i\.localMutes\).+?volume:).+?(?=,)/,
                    replace: "$&>200?200:$&"
                },
                {
                    match: /(?<=Object\.entries\(\i\.localVolumes\).+?volume:).+?(?=})/,
                    replace: "$&>200?200:$&"
                }
            ]
        },
        // Prevent the MediaEngineStore from overwriting our LocalVolumes above 200 with the ones the Discord Audio Context Settings sync sends
        {
            find: '="MediaEngineStore",',
            replacement: [
                {
                    match: /(\.settings\.audioContextSettings.+?)(\i\[\i\])=(\i\.volume)(.+?setLocalVolume\(\i,).+?\)/,
                    replace: (_: string, rest1: string, localVolume: string, syncVolume: string, rest2: string) => rest1
                        + `(${localVolume}>200?void 0:${localVolume}=${syncVolume})`
                        + rest2
                        + `${localVolume}??${syncVolume})`
                }
            ]
        }
    ],

};

export const patches: SourcePatch[] = plugin.patches.map((patch, index) => ({
    id: `volume-booster-${index}`, find: patch.find.replace('#{intl::USER_VOLUME}', '.m7TNdF'),
    replacement: { match: /^[\s\S]*$/, replace(source: string): string {
        for (const replacement of Array.isArray(patch.replacement) ? patch.replacement : [patch.replacement]) {
            const match = new RegExp(replacement.match.source.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)'), replacement.match.flags);
            if (!match.test(source)) throw new Error(`Volume Booster replacement did not match: ${replacement.match}`);
            source = source.replace(match, replacement.replace as any);
        }
        return source;
    } }
}));
export function start(): void {}
