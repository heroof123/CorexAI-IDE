import { useEffect } from 'react';

/**
 * Bu React bileşeni, ekranda görünmez (visually hidden) olan ancak
 * Screen Reader'ların (Ekran Okuyucularının) "ARIA-Live Regions" 
 * konseptini kullanarak arka planda konuşmasını sağlayan bir spikerdir.
 * 
 * CorexAI, kör/görme engelli kullanıcılar için bir işlem bittiğinde,
 * veya yeni bir sorun fark ettiğinde bu görünmez div'ler üzerinden seslenir.
 */
export const CorexAriaLiveRegions = () => {
    // Render the initial empty regions into the DOM
    useEffect(() => {
        // Initialization can handle complex setups, but simple HTML rendering works too
    }, []);

    return (
        <div style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
            {/* Polite updates the user normally via screen reader queue */}
            <div id="corex-aria-live-polite" aria-live="polite" aria-atomic="true"></div>

            {/* Assertive interrupts the user immediately, used for critical AI warnings */}
            <div id="corex-aria-live-assertive" aria-live="assertive" aria-atomic="true"></div>
        </div>
    );
};
