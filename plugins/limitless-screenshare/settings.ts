/* Copyright (c) 2026 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
export const COOLDOWN_MS = 1000;
export const MIN_FPS = 1;
export const MIN_RESOLUTION = 3;
let initializing = true;
function validateResolution(value: number): boolean | string {
    if (!Number.isInteger(value) || value < MIN_RESOLUTION) return 'Resolution must be a whole number of at least 3 pixels.';
    // Bedrock validates defaults before definePluginSettings returns the settings object.
    if (!initializing && settings.store.roundResolution && value % 10 !== 0) return 'Resolution must end in 0 while rounding is enabled.';
    return true;
}
export const settings = Bedrock.definePluginSettings({
    maxFPS: { type: Bedrock.OptionType.NUMBER, label: 'Maximum frame rate', description: 'Upper limit of the frame-rate slider.', default: 120, min: MIN_FPS, step: 1,
        isValid: (value: number) => Number.isInteger(value) && value >= MIN_FPS },
    maxResolution: { type: Bedrock.OptionType.NUMBER, label: 'Maximum resolution', description: 'Upper limit of the resolution slider, in pixels.', default: 1080, min: MIN_RESOLUTION, step: 1, isValid: validateResolution },
    roundResolution: { type: Bedrock.OptionType.BOOLEAN, label: 'Round resolution', description: 'Adjust resolution in steps of 10 pixels.', default: false }
});
initializing = false;
