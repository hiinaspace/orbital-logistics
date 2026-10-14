export const viewportControls = `
<div class="view-tools">
 <label>Frame <select data-control="frame" aria-label="Reference frame"></select></label>
 <details class="camera-menu"><summary data-control="camera-summary">Camera</summary><div class="popover">
 <div class="choice-panel" data-control="camera-view" role="radiogroup" aria-label="Camera view"><span class="choice-heading">View</span><div class="choice-options">
 <label><input type="radio" value="top"><span>Top</span></label><label><input type="radio" value="oblique"><span>3D</span></label><label><input type="radio" value="front"><span>Front</span></label><label><input type="radio" value="side"><span>Side</span></label><label data-control="surface-option" hidden><input type="radio" value="surface"><span>Surface</span></label>
 </div></div>
 <div class="choice-panel" data-control="tracking" role="radiogroup" aria-label="Camera tracking"><span class="choice-heading">Track</span><div class="choice-options">
 <label><input type="radio" value="off"><span>Off</span></label><label><input type="radio" value="follow"><span>Follow</span></label><label><input type="radio" value="chase"><span>Chase</span></label>
 </div></div>
 <output data-control="tracking-target"></output><button data-control="track-selected" title="Track selected object" aria-label="Track selected object">Track selected</button>
 <button data-control="drag-mode" title="Drag to orbit · Shift-drag to pan" aria-pressed="false">Orbit</button>

 </div></details><button data-control="fit" title="Fit the scene (F)">Fit</button>
 <details data-control="layers" class="display-menu"><summary>Display</summary><div class="layer-options">
 <fieldset><legend>Paths</legend><label><input type="checkbox" data-control="layer-orbits" checked>Orbit guides</label><label><input type="checkbox" data-control="layer-plan" checked>Future route</label><label><input type="checkbox" data-control="layer-trails" checked>Past trails</label><label class="trail-control">Length <output data-control="trail-value">1×</output><input data-control="trail-length" type="range" min="0.25" max="2" step="0.05" value="1" aria-label="Trail length"></label></fieldset>
 <fieldset><legend>Appearance</legend><label><input type="checkbox" data-control="layer-labels" checked>Labels</label><label><input type="checkbox" data-control="see-through">See-through bodies</label><label class="entry-layer" hidden><input type="checkbox" data-control="layer-atmosphere" checked>Atmosphere</label><label class="entry-layer" hidden><input type="checkbox" data-control="layer-glow" checked>Entry glow</label></fieldset>
 <fieldset><legend>Dynamics</legend><label data-control="equilibrium-control" hidden><input type="checkbox" data-control="layer-equilibria">Lagrange points</label><div data-control="potential-controls" hidden><label><input type="checkbox" data-control="layer-field">Potential map</label><label><input type="checkbox" data-control="layer-relief">Relief</label><label><input type="checkbox" data-control="layer-grid" checked>Relief grid</label><label class="trail-control">Grid strength <output data-control="grid-strength-value">55%</output><input data-control="grid-strength" type="range" min="0" max="1" step="0.01" value="0.55" aria-label="Grid strength"></label><label class="trail-control">Height <output data-control="relief-value">1×</output><input data-control="relief-height" type="range" min="0" max="3" step="0.05" value="1" aria-label="Relief height"></label></div><label class="entry-layer" hidden><input type="checkbox" data-control="layer-aero">Aerodynamic forces</label></fieldset><button data-control="clear-view" aria-pressed="false">Bodies only</button>
 </div></details><span data-control="frame-name" class="frame-name"></span>
 <button data-control="maximize" class="pane-action" title="Maximize view" aria-label="Maximize view">⛶</button><button data-control="close" class="pane-action" title="Close view" aria-label="Close view">×</button>
</div>
<div class="viewport"><canvas data-control="field-space" aria-hidden="true"></canvas><canvas data-control="relief-space" aria-hidden="true" hidden></canvas><canvas data-control="space" tabindex="0" aria-label="Orbital traffic"></canvas></div>
<div data-control="field-key" class="field-key" title="Specific gravitational potential" hidden>Potential <span></span></div><div data-control="hit-menu" class="hit-menu" hidden></div>`;
