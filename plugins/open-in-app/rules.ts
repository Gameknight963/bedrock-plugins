/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later */
export const apps = {
    spotify: ['Spotify', 'Open Spotify links in Spotify.'],
    steam: ['Steam', 'Open Steam links in Steam.'],
    epic: ['Epic Games', 'Open Epic Games links in the Epic Games Launcher.'],
    tidal: ['Tidal', 'Open Tidal links in Tidal.'],
    itunes: ['iTunes', 'Open Apple Music links in iTunes.'],
    vrcx: ['VRCX', 'Open VRChat links in VRCX.'],
    telegram: ['Telegram', 'Open Telegram links in Telegram.']
} as const;
export type App = keyof typeof apps;
export interface LinkTarget { app: App; uri?: string; short?: boolean }

export function linkTarget(source: string): LinkTarget | undefined {
    let url: URL;
    try { url = new URL(source); } catch { return; }
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return;
    const path = url.pathname;
    let match: RegExpMatchArray | null;
    switch (url.hostname) {
        case 'spotify.link': return path.length > 1 ? { app: 'spotify', short: true } : undefined;
        case 's.team': return path.length > 1 ? { app: 'steam', short: true } : undefined;
        case 'open.spotify.com':
            match = path.match(/^\/(?:intl-[a-z]{2}\/)?(track|album|artist|playlist|user|episode|prerelease)\/([^/]+)\/?$/);
            if (match) return { app: 'spotify', uri: `spotify://${match[1]}/${match[2]}${url.search}${url.hash}` };
            break;
        case 'steamcommunity.com': case 'help.steampowered.com': case 'store.steampowered.com':
            if (path.length > 1) return { app: 'steam', uri: `steam://openurl/${url.href}` };
            break;
        case 'store.epicgames.com':
            if (path.length > 1) return { app: 'epic', uri: `com.epicgames.launcher://store${path}${url.search}${url.hash}` };
            break;
        case 'tidal.com': case 'listen.tidal.com':
            match = path.match(/^\/(?:browse\/)?(track|album|artist|playlist|user|video|mix)\/([a-f0-9-]+)\/?$/i);
            if (match) return { app: 'tidal', uri: `tidal://${match[1]}/${match[2]}` };
            break;
        case 'music.apple.com': case 'geo.music.apple.com':
            match = path.match(/^\/(?:[a-z]{2}\/)?(album|artist|playlist|song|curator)\/([^/]+)(?:\/([^/]+))?\/?$/);
            if (match) return { app: 'itunes', uri: `itunes://music.apple.com/us/${match[1]}/${match[2]}${match[3] ? `/${match[3]}` : ''}${url.search}${url.hash}` };
            break;
        case 'vrchat.com':
            match = path.match(/^\/home\/(user|avatar|world|group)\/([^/]+)\/?$/);
            if (match) return { app: 'vrcx', uri: `vrcx://${match[1]}/${match[2]}` };
            break;
        case 't.me':
            match = path.match(/^\/([a-zA-Z0-9_]+)$/);
            if (match) return { app: 'telegram', uri: `tg://resolve?domain=${match[1]}` };
    }
}

export function accountTarget(platform: string, id: unknown): LinkTarget | undefined {
    if (platform !== 'spotify' && platform !== 'steam') return;
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(id))
        throw new Error(`Invalid ${platform} account ID: ${JSON.stringify(id)}. Expected letters, digits, underscores or hyphens.`);
    return { app: platform, uri: platform === 'spotify' ? `spotify:user:${id}` : `steam://openurl/https://steamcommunity.com/profiles/${id}` };
}
