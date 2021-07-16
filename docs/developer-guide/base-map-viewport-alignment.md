# Base map viewport alignment

As detailed in [Using deck.gl with a Base Map](docs/get-started/using-with-map.md), it is possible add deck.gl layers on top of 3rd party mapping libraries.

When integrating with an external basemap, the primary challenge is
aligning the view and projection matrices, such that the resulting visualization is consistent.

The purpose of this guide is to go over the approach that was taken in calculating the correct transforms when implementing the integration for [Google Vector Maps](https://developers.google.com/maps/documentation/javascript/vector-map). The aim is to help with future integrations with other base maps.

## Simple 2D 

The goal of the integration is to construct [Viewport](docs/api-reference/core/viewport.md), which is exactly aligned with the underlying Google map.

In the 2D case (no rotation or tilting) allowed, this is fairly straightforward, as we just need the following parameters to construct the `view`:

- latitude
- longitude
- zoom

Using the `coordinateTransformer` instance from the Google Maps API, we can easily obtain these:

    const {lat, lng, zoom} = coordinateTransformer.getCameraParams();
    // returns: {lat: 37, lng: -122, zoom: 16.26, tilt: 0, heading: 0} 

If we pass these to deck.gl we will obtain a synced viewport:

    deck.setProps({
      viewState: {
        latitude: lat,
        longitude: lng,
        zoom: zoom - 1 // note difference in zoom level definiton
      }
    });

As both maps are using the [Web Mercator](docs/api-reference/core/web-mercator-viewport.md), alignment is simple.

## Adding rotation & tilt

To add rotation & tilt we can simply extract these from the `coordinateTransfomer` output and pass them onto deck.gl also:

    const {lat, lng, zoom, tilt, heading} = coordinateTransformer.getCameraParams();
    deck.setProps({
      viewState: {
        bearing: heading,
        pitch: tilt,
        latitude: lat,
        longitude: lng,
        zoom: zoom - 1
      }
    });

## The z-buffer

It would seem at this stage we are done, however there is one subtelty which is missing. We have ignored how both libraries treat the z-buffer, in other words how the near and far planes are constructed when building the projection matrix.

In the case of an *overlaid* integration ([see here](docs/get-started/using-with-map.md)) this doesn't matter as all our deck.gl layers will appear on top of the map.

However in the *interleaved* integration it is crucial that the z-buffers are also aligned, otherwise the z-ordering of the deck.gl objects and basemap objects will not be correct.

In the case of Google Vector Maps, we have 3D buildings, and unless the z-buffer is correctly setup the geometries will not intersect as expected.

## Aligning the z-buffer

The problem essentially boils down to constructing the deck.gl [projection matrix](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_model_view_projection#perspective_projection_matrix) such that it is consistent with the Google Maps projection.

This can be done by adding the following configuration to the viewport:

    const projectionMatrix = new Matrix4().perspective({
      fovy: (25 * Math.PI) / 180, // 25 degrees
      aspect: width / height;
      near: 0.3333333432674408,
      far: 300000000000000
    });
    const focalDistance = 0.5 * projectionMatrix[5];

    deck.setProps({
      width, height,
      views: [
        new MapView({
          id: 'google-maps-overlay-view',
          projectionMatrix
        })
      ],
      viewState: {
        altitude,
        bearing,
        latitude,
        longitude,
        pitch,
        repeat: true,
        // Adjust zoom to obtain correct scaling matrix.
        zoom: zoom - 1 - Math.log2(focalDistance)
      }

With this, our z-buffers are aligned and objects appear as if they were drawn in the same scene, even though they are being rendered by two independent libraries.

Of course, at this point the question arises of where these magic numbers come from.

## Matrices

The [Google Maps API](https://developers.google.com/maps/documentation/javascript/webgl/webgl-overlay-view#coordinate_transformations) provides a function to give us a 4D matrix that maps cartesian coordinates relative to a fixed reference point to screen space:

    coordinateTransformer.fromLatLngAltitude(mapOptions.center, 120);

will give us a matrix that will transform points relative to the map center, 120m above ground into the correct location in screen space.

It is tempting to think that we could just use this matrix to replace the `viewProjectionMatrix` that is constructed within the `WebMercatorViewport` but this doesn't work. As deck.gl does coordinate transformations on the GPU we need to instead figure out the projection parameters from this matrix.

To do so, we make the assumption that the matrix (`VPM`) returned by `coordinateTransformer.fromLatLngAltitude` is composed of a view matrix (`VM`) and a projection matrix (`PM`), where the projection matrix is constant (subject to a constant browser window size), while the view matrix changes as the map is moved.

## Inspecting the Google VPM 

In order to have the simplest possible `VM` we orient the map such that the bearing and pitch are 0, thus the `VM` should be composed only of a scale and translation matrix. Then we extract the `VPM` for the map center at 0m elevation:

    coordinateTransformer.fromLatLngAltitude(this._map.center,0);
    // returns Float64Array(16) [
    //   0.00009478,  0,          0,            0,
    //   0,           0.00008664, 0,            0,
    //   0,           0,          -0.00001920, -0.00001920,
    //   0.04601,     0.02680,    0.3333333134651184, 1
    // ]

If we move the map around we notice that in general the matrix has the following form:

    VPM = [A,  0,  0,                   0,
           0,  B,  0,                   0,
           0,  0, -C,                  -C,
           D,  E,  0.3333333134651184,  1]

_Note that element order is row-major to match the arrays used in code, whereas matrices are often written in column-major order_

If we construct our `VM` as a general scale & translation matrix:

    VM = [s_x, 0,   0,   0,
          0,   s_y, 0,   0,
          0,   0,   s_z, 0,
          t_x, t_y, t_z, 1]

and the projection matrix as the [standard OpenGL perspective matrix](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_model_view_projection#perspective_projection_matrix):

    f = 1.0 / Math.tan(fieldOfViewInRadians / 2)
    nf = 1 / (near - far) 
    PM = [f / aspect,   0,      0,                      0,
          0,            f,      0,                      0,
          0,            0,      (near + far) * nf,     -1,
          0,            0,      2 * near * far * nf,    0]

### Far plane

Using the formula `VPM = PM * VM` we can immedately say that `PM[10]` and `PM[11]` are equal due to the duplicate value of `-C` in the `VPM`.

This means that the following equation is true:

    (near + far) / (near - far) = -1

Which is only satifsied if the far plane is at Infinity.

With an infinite far plane, the projection matrix is simplified:

    PM = [f / aspect,   0,      0,            0,
          0,            f,      0,            0,
          0,            0,      -1,          -1,
          0,            0,      -2 * near,    0]


### Derived VPM

We can now rewrite the `VPM` in terms of these parameters, by multiplying `PM` and `VM`:

    VPM = [f * s_x / aspect,   0,            0,                  0,
           0,                  f * s_y,      0,                  0,
           0,                  0,            -s_z,                -1,
           f * t_x / aspect,   f * t_y,      -t_z - 2 * near,    -t_z]


### t_z & near plane

Next, we can use the fact that `VPM[15]` is always `1` to deduce that `t_z = -1` and using this obtain `near = (1 - VPM[14]) / 2`, which gives us the value for the near plane we had above (`0.3333333432674408`)

### Aspect & scaling

If we take the ratio of `VPM[5]` and `VPM[0]` while moving the map we notice that it is constant, and is equal to the aspect ratio of the map (width divided by height). This tells us that `s_x` and `s_y` are equal, which isn't surprising.

### Field of view

Making the assumption that the scale factor is equal in all dimensions, so that `s_y` and `s_z` are equal we can obtain `f = -VPM[5] / VPM[11]`, which gives us a value of `4.510708332061768`. Moving the map around we see that this remains constant, confirming our intuition.

Inverting the definition for `f` to obtain the field of view in degrees:

    fov = (180 / Math.PI ) * 2 * Math.atan(1 / 4.510708332061768)

gives us a field of view of 25 degrees.

## Coverting to deck.gl parameters

Having derived all the necessary values to construct the projection matrix that Google Maps is using, we can build this as shown above and then pass it to the `MapView` which will apply it to the `WebMercatorViewport`.

## Matching zoom factors

What remains is matching up the zoom factors. Because we have changed the field of view, but kept the z-position of the view matrix constant (`altitude` set to 1), the scaling of our map is wrong.

A good way to think about this is in terms of the focal distance of the projection matrix. This is related to the field of view by the following formula:

    focalDistance = 0.5 / tan(0.5 * fovy)

and is also easily obtained from the `projectionMatrix` as `0.5 * projectionMatrix[5]`.

By default, deck.gl (following the convention in mapbox-gl) sets the `focalDistance` to be equal to the `altitude`. If we break from this convention, then everything on screen will appear larger by a scale factor equal to the ratio between the `focalDistnace` and `altitude`, or more simply just `focalDistance` as `altitude` is equal to `1`.

Thus we need to replace `scale` with `scale / focalDistance` when constructing the view matrix. As `scale = Math.pow(2, zoom)` this means `zoom: zoom - 1` from the original viewport becomes `zoom: zoom - 1 - Math.log2(focalDistance)`.

## Helper function

The following function takes a VPM and extract the parameters used above from it. Note it assumes that the view matrix is composed solely of a scale and translation, and so will not work for a rotated or tilted map.

```javascript
const vpmInfo = function(m) {
  const scaleZ = -m[11];
  const scaleY = scaleZ;
  const aspect = m[5] / m[0];
  const f = m[5] / scaleY;
  const info = {
    focalDistance: f / 2,
    aspect,
    scaleZ, // assume equal to scaleX and scaleY
    translateX: (aspect * m[12]) / f,
    translateY: m[13] / f,
    translateZ: -m[15]
  };
  if (m[10] === m[11]) {
    // Far plane is at infinity
    info.near = (m[15] - m[14]) / 2;
    info.far = Infinity;
  } else {
    const a = -m[10] / m[11];
    const b = m[14] - (m[10] * m[15]) / m[11];
    info.far = b / (1 + a);
    info.near = (info.far * (1 + a)) / (a - 1);
  }

  return info;
}
```

Using this on the VPM above yields:

```javascript
vpmInfo([
  0.00009478,  0,          0,            0,
  0,           0.00008664, 0,            0,
  0,           0,          -0.00001920, -0.00001920,
  0.04601,     0.02680,    0.3333333134651184, 1
])

=> {
  aspect: 0.9141169023000633
  far: Infinity
  focalDistance: 2.25625
  near: 0.3333333432674408
  scaleZ: 0.0000192
  translateX: 0.009320447351761975
  translateY: 0.0059390581717451525
  translateZ: -1
}
```
