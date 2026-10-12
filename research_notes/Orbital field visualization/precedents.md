# Orbital field visualization precedents

## Which first-party examples are worth inspecting?

### Takeaway
Falstad supplies the closest interaction vocabulary; ESA and heyoka supply orbital-specific landscape diagrams. The strongest starting point for a watch-first miniature exhibit is a quiet scalar backdrop with a few contours, with arrows and height offered as separate exploratory views. This ranking is a design inference, not a tested usability result.

### Cited Findings
- **1. Falstad, 2-D Vector Field Simulation:** the author explicitly distinguishes particles whose **velocity** follows field vectors from particles whose **acceleration** follows them. It offers potential coloring, floor equipotentials/streamlines, an array of field vectors, flat view and particle-density controls. The field catalog includes inverse-square single/double gravitational fields. Inspect the modern [interactive simulator](https://www.falstad.com/vector2de/vector2de.html), [directions](https://www.falstad.com/vector/directions.html) and [field catalog](https://www.falstad.com/vector/functions.html). This is the most directly relevant precedent for presenting several representations without claiming that they have the same meaning.
- **2. ESA, “The best spot for space astronomy”:** an ESOC mission analyst presents a surface representing the combined effective potential of two bodies and the rotating system. The accompanying caption cautions that the picture alone cannot establish equilibrium stability. Inspect its potential-surface illustration rather than borrowing the operational telescope discussion. [ESA article](https://blogs.esa.int/rocketscience/2012/09/30/the-best-spot-for-space-astronomy/).
- **3. heyoka.py, CR3BP periodic-orbit notebook:** the official example overlays actual integrated trajectories, primary/Lagrange markers and a binary potential-threshold background in both XY and XZ views. Its plotting code is inspectable: it evaluates the potential on a grid and compares it with the initial state's Jacobi quantity. This provides a concrete precedent for a readable permitted/forbidden-region map instead of a decorative bowl. [Notebook and figures](https://bluescarni.github.io/heyoka.py/notebooks/Periodic%20orbits%20in%20the%20CR3BP.html).
- **4. Tellurion, Lagrange-points playground:** the author's demo combines a rotating-frame effective-potential/zero-velocity map and moving test body with a separate one-dimensional potential section along the primary axis. It offers co-rotating/inertial switching, mass ratio and release presets. The page states that the integration includes Coriolis. Treat it as an interaction/layout precedent, not independently verified numerical authority. [Live playground](https://tellurion.dev/playgrounds/bsc-y2s1/AST2004-lagrange-points-cr3bp/index.html).
- **5. Falstad, Electrostatics:** this distinct flat-view demo combines equipotential lines, field lines and vector arrows, and provides independent brightness/equipotential-count controls. Its documentation warns that this particular 2-D charge model uses a line-charge law, not the point-mass inverse-square law. Borrow the visual layering controls, not its physical model. [Demo](https://www.falstad.com/emstatic/) and [directions](https://www.falstad.com/emstatic/directions.html).
- **6. Cabral–Leedom, Line Integral Convolution:** the original research filters texture locally along vector-field curves; it can depict arbitrary 2-D/3-D fields and combine with periodic motion filtering. This is a dense orientation-texture precedent, not inherently a physical particle simulation. Inspect the [original report record](https://digital.library.unt.edu/ark:/67531/metadc1399414/) and the [reprinted electrostatic LIC image](https://www.cs.auckland.ac.nz/~burkhard/PhD/img10.html).

### Inferences
- Falstad's representation switch is more transferable than any particular palette. An exhibit needs fewer simultaneous marks than a field-teaching tool: choose one scalar layer plus an optional directional layer.
- ESA's height picture supplies an immediately recognizable landscape; heyoka's categorical background supplies more specific orbital information. They solve different questions.
- Tellurion's section plot suggests an optional analytical detail panel when the main scene cannot carry another visual dimension.

### Gaps
- These sources do not compare readability while watching multiple freight ships. No playtest or perceptual superiority is established here.
- PhET's [Charges and Fields](https://phet.colorado.edu/en/simulations/charges-and-fields) is another first-party educational candidate, but its canvas exposed no text to this research pass and its official guide fetch failed. Its [old public repository](https://github.com/phetsims/charges-and-fields) now warns that it is unmaintained; it should not be treated as current implementation guidance.

## How should these representations coexist with ships and a true spatial camera?

### Takeaway
Keep physical space and scalar height visibly distinct. A potential surface can be an excellent exploratory diagram, but making every ship ride that surface would conflate potential with actual spatial altitude.

### Cited Findings
- Falstad's flat/surface switch changes the representation of a **2-D** field; its surface height is potential, while its field vectors are displayed in the flat view. That is a precedent for separate analytical representations rather than a spatial-world mesh. [Author's directions](https://www.falstad.com/vector2de/directions.html).
- The heyoka notebook explicitly uses separate XY and XZ sections of a spatial dynamical model, rather than assigning potential to the physical Z coordinate. [Official example](https://bluescarni.github.io/heyoka.py/notebooks/Periodic%20orbits%20in%20the%20CR3BP.html).
- CR3BP effective potential incorporates the rotating frame; the notebook's dynamics contain velocity-dependent terms as well as gravitational terms. A contour backdrop alone therefore does not encode the complete acceleration of a moving ship. [Equations and potential definition](https://bluescarni.github.io/heyoka.py/notebooks/Periodic%20orbits%20in%20the%20CR3BP.html).

### Inferences
- **Recommended default field mode: color plus sparse isolines**, initially in XY Top. Keep contrast below ships/trails, preserve ordinary ship identities and avoid dense contour labels. It leaves the scene's physical coordinate system intact and adds no geometric occlusion.
- **Second choice: sparse arrows**, independently toggled. Their direction can encode gravitational acceleration; magnitude needs an explicit scale/compression convention. Sample a stable grid so panning does not produce distracting mark churn. Hide arrows beneath bodies and immediately around busy selected markers.
- **Third choice: height surface**, a clearly named “potential landscape” exploratory view with an adjustable height gain. Prefer a separate panel/camera or a temporary analytical mode. A diagrammatic sheet tilted below the scene can coexist with the spatial camera only if a visible baseline/slice plane establishes that the sheet is not physical terrain. Never replace a ship's true Z with sheet height. Oblique surfaces can hide their far side and steep wells; this is a foreseeable geometry risk, not a measured failure.
- In full spatial view, a flat field slice is more honest than implying that one height surface describes the whole volume. Expose its plane and epoch in optional details; changing the camera alone must not change the sampled physical field.
- Selected-ship zero-velocity regions would be an advanced energy diagnostic only where the field/frame assumptions admit them. Multiple ships and paid burns should not share a single decorative “forbidden” map.

### Gaps
- The best slice plane and layer density require owner viewing with the actual traffic/camera. No literature source resolves the project's specific aesthetics.

## What controls avoid color/noise and gravity-as-flow confusion?

### Takeaway
Reserve animation for ships initially. Static arrows or quiet static texture communicate field direction without suggesting that spacecraft are carried by a current.

### Cited Findings
- Falstad documents the exact semantic trap: its velocity mode makes particles follow field lines, while force mode lets their velocities differ according to history. Gravity belongs to the acceleration interpretation. [Directions](https://www.falstad.com/vector/directions.html).
- LIC's original report describes texture filtering along a vector field, not integrating inertial spacecraft states. [Original research](https://digital.library.unt.edu/ark:/67531/metadc1399414/).
- Matplotlib recommends monotonic-lightness sequential maps for ordered data and diverging maps for a meaningful central value. It discusses grayscale preservation, labeled contours as redundant cues and the common red/green accessibility problem. [Official colormap guide](https://matplotlib.org/stable/users/explain/colors/colormaps.html).

### Inferences
- Use a restrained sequential lightness scale for potential depth/acceleration magnitude; use a diverging scale only for a meaningful signed difference. Do not inherit Falstad's red/green floor convention. Contours and readable hover values provide non-color cues.
- **Fourth choice: static low-contrast LIC**, optional if sparse arrows feel too diagrammatic. Keep ship paths thicker/cleaner than texture, and include occasional arrows if directional sign matters; texture orientation alone can be ambiguous.
- **Last choice: animated tracer/advection mode**, explicitly exploratory. Constant-speed tracers following gravity directions illustrate a vector field, not orbital motion; realistic test particles would instead need velocities/history and compete with real ships. Motion could also overwhelm the very traffic the exhibit exists to watch.
- Compare all candidates against a field-off baseline with the same playback epoch, camera and selected ship. Judge far-side visibility, arrival recognition, ship identity, grayscale/color-vision appearance and perceived “flow.” This is a proposed owner taste gate, not a request for mandatory formal testing.

### Gaps
- This pass read primary source descriptions/code; it did not execute or record every interactive demo. Animation speed, current browser performance and actual freight-view readability remain unverified.
