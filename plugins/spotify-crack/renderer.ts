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
    noSpotifyAutoPause: {
        label: "Prevent automatic pausing",
        description: "Disable Spotify auto-pause",
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: true
    },
    keepSpotifyActivityOnIdle: {
        label: "Show Spotify while idle",
        description: "Keep Spotify activity playing when idling",
        type: OptionType.BOOLEAN,
        default: false,
        restartNeeded: true
    }
});

const plugin = {
    name: "SpotifyCrack",
    description: "Free listen along, no auto-pausing in voice chat, and allows activity to continue playing when idling",
    settings,

    patches: [
        {

            find: 'dispatch({type:"SPOTIFY_PROFILE_UPDATE"',
            replacement: {
                match: /SPOTIFY_PROFILE_UPDATE.+?isPremium:(?="premium"===(\i)\.body\.product)/,
                replace: (m: string, req: string) => `${m}(${req}.body.product="premium")&&`
            },
        },
        {
            find: "}getPlayableComputerDevices(){",
            replacement: [
                {
                    predicate: () => settings.store.noSpotifyAutoPause,
                    match: /(?<=function \i\(\){)(?=.{0,200}SPOTIFY_AUTO_PAUSED\))/,
                    replace: "return;"
                },
                {
                    predicate: () => settings.store.keepSpotifyActivityOnIdle,
                    match: /(shouldShowActivity\(\){.{0,50})&&!\i\.\i\.isIdle\(\)/,
                    replace: "$1"
                }
            ]
        }
    ]
};
export const patches: SourcePatch[] = plugin.patches.map((patch, index) => ({ id: `spotify-crack-${index}`, find: patch.find,
    replacement: { match: /^[\s\S]*$/, replace(source: string): string {
        for (const replacement of Array.isArray(patch.replacement) ? patch.replacement : [patch.replacement]) {
            if ('predicate' in replacement && replacement.predicate?.() === false) continue;
            const match = new RegExp(replacement.match.source.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)'), replacement.match.flags);
            if (!match.test(source)) throw new Error(`Spotify Crack replacement did not match: ${replacement.match}`);
            source = source.replace(match, replacement.replace as any);
        }
        return source;
    } }
}));
export function start(): void {}
