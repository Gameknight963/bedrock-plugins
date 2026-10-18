/* Adapted from Vencord/Equicord; modified for Bedrock on 2026-10-17.
 * Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * See NOTICE for source and authorship. */
export function installPlayer(volume) {
    if (globalThis.bedrockSpotifyVolume) { globalThis.bedrockSpotifyVolume.setVolume(volume); return; }
    const original = Audio.prototype.play;
    const descriptor = Object.getOwnPropertyDescriptor(Audio.prototype, 'play');
    const media = new Map();
    const apply = audio => {
        if (!media.has(audio)) media.set(audio, { original: audio.volume, applied: volume });
        media.get(audio).applied = volume;
        audio.volume = volume;
    };
    const play = function (...args) { apply(this); return original.apply(this, args); };
    const state = {
        setVolume(value) { volume = value; for (const audio of media.keys()) apply(audio); },
        dispose() {
            document.removeEventListener('play', onPlay, true);
            if (Audio.prototype.play === play) {
                if (descriptor) Object.defineProperty(Audio.prototype, 'play', descriptor);
                else delete Audio.prototype.play;
            }
            for (const [audio, values] of media) if (audio.volume === values.applied) audio.volume = values.original;
            media.clear();
            if (globalThis.bedrockSpotifyVolume === state) delete globalThis.bedrockSpotifyVolume;
        }
    };
    const onPlay = event => { if (event.target instanceof HTMLAudioElement) apply(event.target); };
    Audio.prototype.play = play;
    document.addEventListener('play', onPlay, true);
    for (const audio of document.querySelectorAll('audio')) apply(audio);
    globalThis.bedrockSpotifyVolume = state;
}
