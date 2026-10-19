let removeStyle, unsubscribe;

export function start(ctx) {
    const apply = enabled => {
        if (enabled && !removeStyle) {
            // Chromium also checks CSS drag regions internally, beyond our native WM_NCHITTEST handler.
            removeStyle = ctx.styles.add('*, *::before, *::after { -webkit-app-region: no-drag !important; app-region: no-drag !important; }');
        } else if (!enabled && removeStyle) {
            removeStyle();
            removeStyle = undefined;
        }
    };
    apply(ctx.settings.get('nativeTitlebar', false));
    unsubscribe = ctx.events.on('settings.changed', event => {
        if (event.id === ctx.id) apply(event.settings.nativeTitlebar === true);
    });
}

export function stop() {
    unsubscribe?.();
    unsubscribe = undefined;
    removeStyle?.();
    removeStyle = undefined;
}
