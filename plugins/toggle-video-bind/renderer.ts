/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { RendererContext } from '@bedrock/renderer';
const { definePluginSettings, OptionType } = Bedrock;
let context: RendererContext;
const validKeycodes = [
    "Backspace", "Tab", "Enter", "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight", "Pause", "CapsLock",
    "Escape", "Space", "PageUp", "PageDown", "End", "Home", "ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "PrintScreen", "Insert",
    "Delete", "Digit0", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "KeyA", "KeyB", "KeyC",
    "KeyD", "KeyE", "KeyF", "KeyG", "KeyH", "KeyI", "KeyJ", "KeyK", "KeyL", "KeyM", "KeyN", "KeyO", "KeyP", "KeyQ", "KeyR", "KeyS", "KeyT",
    "KeyU", "KeyV", "KeyW", "KeyX", "KeyY", "KeyZ", "MetaLeft", "MetaRight", "ContextMenu", "Numpad0", "Numpad1", "Numpad2", "Numpad3",
    "Numpad4", "Numpad5", "Numpad6", "Numpad7", "Numpad8", "Numpad9", "NumpadMultiply", "NumpadAdd", "NumpadSubtract", "NumpadDecimal",
    "NumpadDivide", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "NumLock", "ScrollLock",
];

export const settings = definePluginSettings({
    keyBind: {
        label: "Key code",
        description: "The key to toggle webcam when pressed.",
        type: OptionType.STRING,
        default: "KeyX",
        isValid: (value: string) => validKeycodes.includes(value),
    },
    reqCtrl: {
        label: "Require Ctrl",
        description: "Require control to be held.",
        type: OptionType.BOOLEAN,
        default: true,
    },
    reqShift: {
        label: "Require Shift",
        description: "Require shift to be held.",
        type: OptionType.BOOLEAN,
        default: true,
    },
    reqAlt: {
        label: "Require Alt",
        description: "Require alt to be held.",
        type: OptionType.BOOLEAN,
        default: false,
    },
});

export function handleKeydown({ code, ctrlKey, shiftKey, altKey, repeat }: KeyboardEvent) {
    if (context.signal.aborted || repeat) return;
    const { keyBind, reqCtrl, reqShift, reqAlt } = settings.store;
    if (keyBind !== code || ctrlKey !== reqCtrl || shiftKey !== reqShift || altKey !== reqAlt) { return; }

    const dispatcher = context.webpack.find<{ dispatch(event: unknown): void }>(value => typeof value?.dispatch === "function" && typeof value?.subscribe === "function");
    const media = context.webpack.find<{ isVideoEnabled(): boolean }>(value => typeof value?.isVideoEnabled === "function");
    if (!dispatcher || !media) return;
    dispatcher.dispatch({
        type: "MEDIA_ENGINE_SET_VIDEO_ENABLED",
        enabled: !media.isVideoEnabled(),
    });
}

export function start(ctx: RendererContext): void {
    context = ctx;
    document.addEventListener('keydown', handleKeydown);
}
export function stop(): void { document.removeEventListener('keydown', handleKeydown); }
