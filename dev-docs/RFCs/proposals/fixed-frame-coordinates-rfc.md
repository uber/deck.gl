# RFC: Fixed Frame Coordinate Support RFC

* **Authors**: Ib Green
* **Date**: Jul 2019, updated April 2020
* **Status**: Proposal

## Summary

This RFC proposes adding built-in support for Fixed Frame geospatial coordinates (WGS84 Cartesian / ECF / ECEF / ...) to deck.gl.


## Background

Two major notation approaches for geospatial datums are cartographic (lng/lat/z relative to surface of earth) and fixed frame (x,y,z meters from center of earth).

deck.gl has traditionally been focused on supporting cratographic coordinates (lng/lats) as efficiently as possible, as lng/lats are most commonly used to annotate big data.

However, fixed frame geospatial coordinates are also well-defined and have a complementary set of advantages over cartographic notation that are valuable in important use cases.

During our collaboration with the Cesium team around 3D tiles in loaders.gl and math.gl, we had to implement support for fixed frame geospatial coordinates in math.gl (for Ellipsoid math and WGS84 transformations from cartesian to cartographic coordinates).

Because of the 3D Tiles effort, we now have a more mature understanding of fixed frame geospatial coordinates,
and several required pieces are already available, meaning the implementation effort for this RFC should be quite small.

- The necessary support library is now implemented `@math.gl/ellipsoid` and "battle-tested" in the `Tile3DLayer`.
- The `Tile3DLayer`.an initial use case for WGS84 support, it could be simplified if WGS84 was supported natively by deck.gl
- In fact the glue code in the Tile3DLayer could be used as a starting point.


## Overview

To make support for fixed frame coordinates into a "first class citizen" we would ideally added it in several places in the API:
* Layers: New coordinate system
* View States: Support fixed frame view states
* Unprojection/Picking: Returned coordinates


## Use Cases

The 3D tiles implementation in loaders.gl would an important pilot use case, making sure that fixed frame support in deck.gl is built for a real, testable use case.

In addition, the `Tile3DLayer` implementation would be slightly simplified as it would be able to rely on deck.gl. The size/complexity wins in loaders.gl are welcome but not that significant, however the debuggability/maintainability of the Tile3DTraversal code might be considerably improved by having a cleaner end-to-end system, which is important as the long-term maintenance of this code needs to be secored.

We are also getting requests for fixed frame coordinate support from potential users of other vis.gl frameworks, e.g. streetscape.gl / AVS.auto, and being able to whow that our stack supports them "ground up" might be important to unblock certain partnerships.

While the initial proposal is to implement a local ENU transformation matrix to cartographic coordinated, longer-term, the ability to do shader work in a fixed, uniform space across all deck.gl layers/data could significantly simplify the use of traditional 3D techniques, and also simplify 3D globe type visualizations, e.g. enabling us to integrate more closely with systems such as Cesium.


## Proposals

### Proposal: New COORDINATE_SYSTEM.WGS84 for layers

The main addition would be to add a new `COORDINATE_SYSTEM.FIXED_FRAME` coordinate system mode in the `Layer.coordinateSystem` property enabling users to supply data in fixed frame coordinates.

```js
new Layer({
  coordinateSystem: COORDINATE_SYSTEM.FIXED_FRAME,
  data: [...] // coordinates in WGS84 cartesian
})
```

Layers can currently specify coordinates in `COORDINATE_SYSTEM.LNGLAT`, or `COORDINATE_SYSTEM.METER_OFFSETS` (local East-North-Up coordinates from an origin).

Implementation-wise, rendering would still happen in "cartographic" our layer shaders would use `@math.gl/geospatial` to generate a transformation matrix from fixed coordinates to a local ENU coordinate system, multiply that with any model matrix, and then treat the layer data `COORDINATE_SYSTEM.METER_OFFSETS`.

The local ENU coordinate system could have its origin in the current view state center.

Proposals for naming:

- `COORDINATE_SYSTEM.WGS84`
- `COORDINATE_SYSTEM.WGS84_CARTESIAN`
- `COORDINATE_SYSTEM.CARTESIAN_WGS84`
- `COORDINATE_SYSTEM.ECF`, ...

Notes:
- is that WGS84 defines both cartesian and cartographic coordinates.
- Cesium uses WGS84 as it base coordinate system and just calls it `Cartesian`
- Does deck.gl need both `CARTESIAN` and `WGS84_CARTESIAN`. The difference is the defined center point, ajd whether things work with MapViews and how cartographic coordinates map to Cartesian. Explore how we can unify as much as possible.
- Aliasing `LNGLAT` to `WGS84_CARTOGRAPHIC` could make sense, though we may want to work through subtleties of how WGS84 is defined (Epochs, relation to WebMercator etc).


### Proposal: Fixed Frame (WGS84 Cartesian) View States

To enable specifying view states in cartesian, geospatial viewports need accept `{x, y, z}` objects.

At a minimum, we could just convert a fixed frame x,y,z datum to a cartographic/geodesic datum and use it as a traditional geospatial view state.

Consideration: There is currently some some support for a meter offset `position` in geospatial view states (possibly partially broken). Worth looking at how that would align, and also see if things can be kept reasonably similar with other non-geospatial view states.


### Proposal: Return Fixed Frame Coordinates when unprojecting/picking

A deck.gl layer stack can have a bunch of coordinate systems in play. Our unproject and picking functions should make is easy to work with returned coordinates (e.g. apps often want coordinates back in the same form they were put in, METER_OFFSETS, FIXED_FRAME etc).

TBA...


## Longer term Possibilities

Some ideas for future steps. These proposals would likely require separate RFCs

### Proposal: Adopt WGS84 as our World coordinate system

This RFC proposes a light-weight integration of WGS84 into our current projection system and shader architecture.

We could however also refactor layer shaders to work in WGS84 directly, and convert other coordinate systems to WGS84. This approach could make sense if pursuing globe style visualization, similar to Cesium.

A big advantage is that we would have a view-state-independent and uniform (meter scaled) world coordinate system, simplifying the application of classical 3D math and techniques.

We'd want to investage performance, precision etc issues before making any changes.


### Proposal: Allow arbitrary Ellipsoid as COORDINATE_SYSTEM

This one is not really considered an important proposal, but added to illustrate how easily this system could be generalized to handle e.g. non-default earth ellipsoids or other planetary bodies.

 ```js
import {Ellipsoid} from '@math.gl/geospatial';

const MARS_ELLIPSOID = new Ellipsoid(MARS_RADIUS_X, MARS_RADIUS_Y, MARS_RADIUS_Z);

new Layer({
  coordinateSystem: MARS_ELLIPSOID,
  data: [...] // coordinates in cartesian
})
```

### Proposal: Built-in Frustum Culling Functionality in deck.gl

Each layer would calculate its bounds (could be supported by loaders.gl and math.gl)

Frustum culling should be easier to implement in a fixed coordinate system.
