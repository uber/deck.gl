# WebMercatorViewport

The `WebMercatorViewport` class takes map view states (`latitude`, `longitude`, `zoom`, `pitch`, `bearing` etc.), and performs projections between world and screen coordinates. It is tuned to work in synchronization with `mapbox-gl`'s projection matrix.

## Usage

The `WebMercatorViewport` is the default viewport for deck.gl, created under the hood by a [MapView](/docs/api-reference/core/map-view.md).

```js
import {WebMercatorViewport} from '@deck.gl/core';

const viewport = new WebMercatorViewport({
  width: 600,
  height: 400,
  longitude: -122.45,
  latitude: 37.78,
  zoom: 12,
  pitch: 30,
  bearing: 15
});

viewport.project([-122.45, 37.78]);
// [300,200]
```


## Constructor

```js
new WebMercatorViewport({width, height, longitude, latitude, zoom, pitch, bearing});
```

Parameters:

* `opts` (Object) - Web Mercator viewport options

  + `width` (Number) - Width of the viewport.
  + `height` (Number) - Height of the viewport.

  web mercator style arguments:

  + `latitude` (Number, optional) - Latitude of the viewport center on map. Default to `0`.
  + `longitude` (Number, optional) - Longitude of the viewport center on map. Default to `0`.
  + `zoom` (Number, optional) - Map zoom (scale is calculated as `2^zoom`). Default to `11`.
  + `pitch` (Number, optional) - The pitch (tilt) of the map from the screen, in degrees (0 is straight down). Default to `0`.
  + `bearing` (Number, optional) - The bearing (rotation) of the map from north, in degrees counter-clockwise (0 means north is up). Default to `0`.
  + `altitude` (Number, optional) - Altitude of camera in screen units. Default to `1.5`.

  projection matrix arguments:

  + `nearZMultiplier` (Number, optional) - Scaler for the near plane, 1 unit equals to the height of the viewport. Default to `0.1`.
  + `farZMultiplier` (Number, optional) - Scaler for the far plane, 1 unit equals to the distance from the camera to the top edge of the screen. Default to `1.01`.
  + `orthographic` (Boolean, optional) - Default `false`.
  + `projectionMatrix` (Array, optional) - Optional 16-element 4x4 projection matrix, that overrides the matrix created from the parameters above.

Remarks:

* `altitude` has a default value that matches assumptions in mapbox-gl
* `width` and `height` are forced to 1 if supplied as 0, to avoid division by zero. This is intended to reduce the burden of apps to check values before instantiating a `Viewport`.
*  When using Mercator projection, per cartographic tradition, longitudes and latitudes are specified as degrees.
* `latitude` of `90` or `-90` are projected to infinity in [Web Mercator projection](https://en.wikipedia.org/wiki/Web_Mercator_projection). Using pole locations with this viewport may result in `NaN`s. Many base map providers cut off at `85.051129` at which the full world becomes a square.
* When constructing the viewport, a field of view is not specified, but rather is calculated from the `altitude` or (if present) the `projectionMatrix`. The value can be obtained from `this.fovy` (in radians).

Inherits all [Viewport methods](/docs/api-reference/core/viewport.md#methods).

## Methods

Inherits all methods from [Viewport](/docs/api-reference/core/viewport.md).

##### `project`

Projects world coordinates to pixel coordinates on screen.

Parameters:

* `coordinates` (Array) - `[longitude, latitude, altitude]`. `altitude` is in meters and default to `0` if not supplied.
* `opts` (Object)
  + `topLeft` (Boolean, optional) - Whether projected coords are top left. Default to `true`.

Returns:

* `[x, y]` or `[x, y, z]` in pixels coordinates. `z` is pixel depth.
  + If input is `[longitude, latitude]`: returns `[x, y]`.
  + If input is `[longitude, latitude: altitude]`: returns `[x, y, z]`.


##### `unproject`

Unproject pixel coordinates on screen into world coordinates.

Parameters:

* `pixels` (Array) - `[x, y, z]` in pixel coordinates. Passing a `z` is optional.
* `opts` (Object)
  + `topLeft` (Boolean, optional) - Whether projected coords are top left. Default to `true`.
  + `targetZ` (Number, optional) - If pixel depth `z` is not specified in `pixels`, this is used as the elevation plane to unproject onto. Default `0`.

Returns:

* `[longitude, latitude]` or `[longitude, latitude, altitude]` in world coordinates. `altitude` is in meters.
  + If input is `[x, y]` without specifying `opts.targetZ`: returns `[longitude, latitude]`.
  + If input is `[x, y]` with `opts.targetZ`: returns `[longitude, latitude, targetZ]`.
  + If input is `[x, y, z]`: returns `[longitude, latitude, altitude]`.


##### `getDistanceScales`

Returns an object with scale values supporting first order (linear) and second order (quadratic) approximations of the local Web Mercator projection scale around the viewport center. Error increases with distance from viewport center (very roughly 1% per 100km in linear mode, quadratic approximation does significantly better).

Returns:

* An object with precalculated distance scales allowing conversion between lnglat deltas, meters and pixels.


##### `addMetersToLngLat`

Add a meter delta to a base lnglat coordinate using linear approximation. For information on numerical precision, see remarks on [`getDistanceScales`](#-getdistancescales-).

Parameters:

* `lngLatZ` (Array) - Base coordinate in `[longitude, latitude, altitude]`. Passing a `altitude` is optional.
* `xyz` (Array) - Array of `[x, y, z]` in meter deltas. Passing a `z` is optional.

Returns:

* New coordinate array in `[longitude, latitude]` or `[longitude, latitude, altitude]` if `z` is provided.

##### `fitBounds`

Returns a new viewport that fit around the given bounding box. Only supports non-perspective mode.

Parameters:

* `bounds` (Array) - Bounding box in `[[longitude, latitude], [longitude, latitude]]`.
* `opts` (Object)
  + `padding` (Number) - The amount of padding in pixels to add to the given bounds.
  + `offset` (Array) - The center in `[x, y]` of the given bounds relative to the map's center measured in pixels.
  
Returns: 

* New `WebMercatorViewport` fit around the given bounding box.

## Remarks

* Because `WebMercatorViewport` a subclass of `Viewport`, an application can implement support for generic 3D `Viewport`s and automatically get the ability to accept web mercator style map coordinates.
* A limitation at the moment is that there is no way to extract web mercator parameters from a "generic" viewport, so for map synchronization applications (rendering on top of a typical map component that only accepts web mercator parameters) the `WebMercatorViewport` is necessary.
* Facilitates the necessary mercator projections by breaking them into a minimal non-linear piece followed by a standard projection chain.
* Making deck.gl work with non-mapbox map systems **in perspective mode** might require subclassing `WebMercatorViewport` and adjust the projection so it matches the map's projection.


## Source

[modules/core/src/viewports/web-mercator-viewport.js](https://github.com/visgl/deck.gl/blob/master/modules/core/src/viewports/web-mercator-viewport.js)
