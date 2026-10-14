/* Adapted for Bedrock on 2026-10-12: reversible hooks, styles, observers and timers. */

/**
 * This file is part of AdGuard's Block YouTube Ads (https://github.com/AdguardTeam/BlockYouTubeAdsShortcut).
 *
 * Copyright (C) AdGuard Team
 *
 * AdGuard's Block YouTube Ads is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * AdGuard's Block YouTube Ads is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdGuard's Block YouTube Ads.  If not, see <http://www.gnu.org/licenses/>.
 */
(() => {
    if (window.bedrockYoutubeAdblock) return;
    let active = true;
    const cleanup = [];
    const timers = new Set();
    const hiddenParents = new Map();
    const state = { dispose() {
        active = false;
        for (const timer of timers) clearTimeout(timer);
        for (const dispose of cleanup.reverse()) dispose();
        for (const [element, display] of hiddenParents) {
            if (element.style.display === "none") element.style.display = display;
        }
        if (window.bedrockYoutubeAdblock === state) delete window.bedrockYoutubeAdblock;
    } };
    window.bedrockYoutubeAdblock = state;
    try {
    const hiddenCSS = [
        "#__ffYoutube1",
        "#__ffYoutube2",
        "#__ffYoutube3",
        "#__ffYoutube4",
        "#feed-pyv-container",
        "#feedmodule-PRO",
        "#homepage-chrome-side-promo",
        "#merch-shelf",
        "#offer-module",
        '#pla-shelf > ytd-pla-shelf-renderer[class="style-scope ytd-watch"]',
        "#pla-shelf",
        "#premium-yva",
        "#promo-info",
        "#promo-list",
        "#promotion-shelf",
        "#related > ytd-watch-next-secondary-results-renderer > #items > ytd-compact-promoted-video-renderer.ytd-watch-next-secondary-results-renderer",
        "#search-pva",
        "#shelf-pyv-container",
        "#video-masthead",
        "#watch-branded-actions",
        "#watch-buy-urls",
        "#watch-channel-brand-div",
        "#watch7-branded-banner",
        "#YtKevlarVisibilityIdentifier",
        "#YtSparklesVisibilityIdentifier",
        ".carousel-offer-url-container",
        ".companion-ad-container",
        ".GoogleActiveViewElement",
        '.list-view[style="margin: 7px 0pt;"]',
        ".promoted-sparkles-text-search-root-container",
        ".promoted-videos",
        ".searchView.list-view",
        ".sparkles-light-cta",
        ".watch-extra-info-column",
        ".watch-extra-info-right",
        ".ytd-carousel-ad-renderer",
        ".ytd-compact-promoted-video-renderer",
        ".ytd-companion-slot-renderer",
        ".ytd-merch-shelf-renderer",
        ".ytd-player-legacy-desktop-watch-ads-renderer",
        ".ytd-promoted-sparkles-text-search-renderer",
        ".ytd-promoted-video-renderer",
        ".ytd-search-pyv-renderer",
        ".ytd-video-masthead-ad-v3-renderer",
        ".ytp-ad-action-interstitial-background-container",
        ".ytp-ad-action-interstitial-slot",
        ".ytp-ad-image-overlay",
        ".ytp-ad-overlay-container",
        ".ytp-ad-progress",
        ".ytp-ad-progress-list",
        '[class*="ytd-display-ad-"]',
        '[layout*="display-ad-"]',
        'a[href^="http://www.youtube.com/cthru?"]',
        'a[href^="https://www.youtube.com/cthru?"]',
        "ytd-action-companion-ad-renderer",
        "ytd-banner-promo-renderer",
        "ytd-compact-promoted-video-renderer",
        "ytd-companion-slot-renderer",
        "ytd-display-ad-renderer",
        "ytd-promoted-sparkles-text-search-renderer",
        "ytd-promoted-sparkles-web-renderer",
        "ytd-search-pyv-renderer",
        "ytd-single-option-survey-renderer",
        "ytd-video-masthead-ad-advertiser-info-renderer",
        "ytd-video-masthead-ad-v3-renderer",
        "YTM-PROMOTED-VIDEO-RENDERER",
    ];
    /**
     * Adds CSS to the page
     */
    const hideElements = () => {
        const selectors = hiddenCSS;
        if (!selectors) {
            return;
        }
        const rule = selectors.join(", ") + " { display: none!important; }";
        const style = document.createElement("style");
        style.textContent = rule;
        document.head.appendChild(style);
        cleanup.push(() => style.remove());
    };
    /**
     * Calls the "callback" function on every DOM change, but not for the tracked events
     * @param {Function} callback callback function
     */
    const observeDomChanges = callback => {
        const domMutationObserver = new MutationObserver(mutations => {
            if (active) callback(mutations);
        });
        cleanup.push(() => domMutationObserver.disconnect());
        domMutationObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
        });
    };
    /**
     * This function is supposed to be called on every DOM change
     */
    const hideDynamicAds = () => {
        const elements = document.querySelectorAll("#contents > ytd-rich-item-renderer ytd-display-ad-renderer");
        if (elements.length === 0) {
            return;
        }
        elements.forEach(el => {
            if (el.parentNode && el.parentNode.parentNode) {
                const parent = el.parentNode.parentNode;
                if (parent.localName === "ytd-rich-item-renderer") {
                    if (!hiddenParents.has(parent)) hiddenParents.set(parent, parent.style.display);
                parent.style.display = "none";
                }
            }
        });
    };
    /**
     * This function checks if the video ads are currently running
     * and auto-clicks the skip button.
     */
    const autoSkipAds = () => {
        // If there's a video that plays the ad at this moment, scroll this ad
        if (document.querySelector(".ad-showing")) {
            const video = document.querySelector("video");
            if (video && video.duration) {
                video.currentTime = video.duration;
                // Skip button should appear after that,
                // now simply click it automatically
                const timer = setTimeout(() => {
                    timers.delete(timer);
                    if (!active) return;
                    const skipBtn = document.querySelector("button.ytp-ad-skip-button");
                    if (skipBtn) {
                        skipBtn.click();
                    }
                }, 100);
                timers.add(timer);
            }
        }
    };
    /**
     * This function overrides a property on the specified object.
     *
     * @param {object} obj object to look for properties in
     * @param {string} propertyName property to override
     * @param {*} overrideValue value to set
     */
    const overrideObject = (obj, propertyName, overrideValue) => {
        if (!obj) {
            return false;
        }
        let overriden = false;
        for (const key in obj) {
            if (Object.hasOwn(obj, key) && key === propertyName) {
                obj[key] = overrideValue;
                overriden = true;
            } else if (Object.hasOwn(obj, key) && typeof obj[key] === "object") {
                if (overrideObject(obj[key], propertyName, overrideValue)) {
                    overriden = true;
                }
            }
        }
        return overriden;
    };
    /**
     * Overrides JSON.parse and Response.json functions.
     * Examines these functions arguments, looks for properties with the specified name there
     * and if it exists, changes it's value to what was specified.
     *
     * @param {string} propertyName name of the property
     * @param {*} overrideValue new value for the property
     */
    const jsonOverride = (propertyName, overrideValue) => {
        const nativeJSONParse = JSON.parse;
        const parse = (...args) => {
            const obj = nativeJSONParse.apply(this, args);
            // Override it's props and return back to the caller
            if (active) overrideObject(obj, propertyName, overrideValue);
            return obj;
        };
        JSON.parse = parse;
        cleanup.push(() => { if (JSON.parse === parse) JSON.parse = nativeJSONParse; });
        // Override Response.prototype.json
        const nativeResponseJson = Response.prototype.json;
        const responseJson = new Proxy(nativeResponseJson, {
            async apply(...args) {
                // Call the target function, get the original Promise
                const result = await Reflect.apply(...args);
                // Create a new one and override the JSON inside
                if (active) overrideObject(result, propertyName, overrideValue);
                return result;
            },
        });
        Response.prototype.json = responseJson;
        cleanup.push(() => { if (Response.prototype.json === responseJson) Response.prototype.json = nativeResponseJson; });
    };
    // Removes ads metadata from YouTube XHR requests
    jsonOverride("adPlacements", []);
    jsonOverride("playerAds", []);
    // Applies CSS that hides YouTube ad elements
    hideElements();
    // Some changes should be re-evaluated on every page change
    hideDynamicAds();
    autoSkipAds();
    observeDomChanges(() => {
        hideDynamicAds();
        autoSkipAds();
    });
    } catch (error) {
        state.dispose();
        throw error;
    }
})();
