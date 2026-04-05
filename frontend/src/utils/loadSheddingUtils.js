/**
 * loadSheddingUtils.js
 * 
 * Shared utility functions for Load Shedding MW calculations.
 * Used by both LoadSheddingDesigner and LoadSheddingViewer to ensure
 * identical metric computation. Single source of truth.
 * 
 * Both components deal with the same underlying data but in different shapes:
 *  - Designer: pocket data lives in `stage.computed_pockets[]` with keys
 *              { pocket_substations, substation_mw, total_p_mw, ... }
 *  - Viewer:   pocket data comes from the API response in `stage.pocket_bays[]` with
 *              { topology_cache: { isolated_substations, substation_mw, mw } }
 * 
 * This utility normalises both shapes into a common form before computing metrics.
 */

/**
 * Normalise a Viewer API pocket_bay into the Designer's pocket card shape.
 * @param {Object} pocketBay - A raw pocket_bay object from the API response
 * @returns {Object} A normalised pocket card
 */
export function normalisePocketBay(pocketBay) {
    const cache = pocketBay.topology_cache || {};
    return {
        pocket_substations: cache.isolated_substations || [],
        substation_mw: cache.substation_mw || {},        // { subId: { total_p_mw, total_q_mvar } }
        total_p_mw: cache.mw || 0,
    };
}

/**
 * Compute aggregate scheme metrics across all stages, deduplicating substations.
 * Pocket bay assignments take priority over (and overwrite) TX bay assignments for
 * the same substation — matching the real shedding logic.
 *
 * @param {Array}  stageDetails   - Array of stage objects.
 * @param {Array}  substations    - Array of substation master data objects ({ substation_id, region, total_pload_mw })
 * @param {Function} getPocketCards - Function(stage) => normalised pocket card array
 * @param {Function} getBayMW        - Function(bay) => number (MW value for this bay)
 * @param {Function} isBayCritical   - Function(bay) => boolean (is this bay critical?)
 * @param {Array}    criticalAssets  - Array of critical asset objects (for pocket level checks)
 *
 * @returns {{ totalMW, substationCount, pocketCount, stageCount, regionalAssigned, criticalSubs, criticalMW }}
 */
export function computeSchemeMetrics(stageDetails, substations, getPocketCards, getBayMW, isBayCritical, criticalAssets = []) {
    // Per-substation map: { mw, region, isCritical } — pockets override TX bays
    const subMWMap = new Map();
    let totalPockets = 0;

    stageDetails.forEach(stage => {
        // Pass 1: TX bay assignments (lower priority)
        (stage.transformer_bays || []).forEach(bay => {
            const subId = bay.relay_substation_id;
            if (!subId) return;
            const mw = getBayMW(bay);
            const isCritical = isBayCritical(bay);
            const sub = substations.find(s => s.substation_id === subId);
            
            if (!subMWMap.has(subId)) {
                subMWMap.set(subId, { mw, region: sub?.region || null, isCritical });
            } else {
                const existing = subMWMap.get(subId);
                existing.mw += mw;
                if (isCritical) existing.isCritical = true;
            }
        });

        // Pass 2: Network pocket assignments (higher priority — overrides TX for same subs)
        const pocketCards = getPocketCards(stage);
        pocketCards.forEach(card => {
            const { pocket_substations = [], substation_mw = {}, total_p_mw = 0 } = card;
            if (!pocket_substations.length) return;
            totalPockets++;

            // Per-substation load within pocket for regional distribution
            const totalLoadInPocket = pocket_substations.reduce((sum, sId) => {
                const s = substations.find(srv => srv.substation_id === sId);
                return sum + (parseFloat(s?.total_pload_mw) || 0);
            }, 0);

            pocket_substations.forEach(subId => {
                const sub = substations.find(s => s.substation_id === subId);
                let subMW = 0;
                if (substation_mw[subId]?.total_p_mw != null) {
                    subMW = substation_mw[subId].total_p_mw;
                } else if (totalLoadInPocket > 0) {
                    subMW = ((parseFloat(sub?.total_pload_mw) || 0) / totalLoadInPocket) * total_p_mw;
                } else {
                    subMW = total_p_mw / (pocket_substations.length || 1);
                }

                // Check pocket level criticality
                const isCritical = criticalAssets.some(ca => {
                    const caSubId = (ca.substation_id || ca.substation)?.toString().trim().toUpperCase();
                    return caSubId === subId.toString().trim().toUpperCase();
                });

                // Pocket OVERRIDES any existing TX bay entry for total MW and criticality
                subMWMap.set(subId, { mw: subMW, region: sub?.region || null, isCritical });
            });
        });
    });

    // Aggregate from deduplicated substation map
    let totalMW = 0;
    let criticalSubs = 0;
    let criticalMW = 0;
    const regionalAssigned = {};
    
    subMWMap.forEach(({ mw, region, isCritical }) => {
        totalMW += mw;
        if (isCritical) {
            criticalSubs++;
            criticalMW += mw;
        }
        if (region) {
            regionalAssigned[region] = (regionalAssigned[region] || 0) + mw;
        }
    });

    return {
        totalMW,
        substationCount: subMWMap.size,
        pocketCount: totalPockets,
        stageCount: stageDetails.length,
        regionalAssigned,
        criticalSubs,
        criticalMW,
        totalSubs: subMWMap.size
    };
}
