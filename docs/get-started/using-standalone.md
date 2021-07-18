# Using deck.gl without React

The deck.gl core library and layers have no dependencies on React or Mapbox GL and can be used by any JavaScript application.

Our [get-started examples](https://github.com/visgl/deck.gl/tree/master/examples/get-started) contains vanilla JavaScript templates that serve as a starting point for your application.


## Using @deck.gl/core

` @deck.gl/core` is a submodule of deck.gl that contains no React dependency.

The [Deck](/docs/api-reference/core/deck.md) class takes deck.gl layer instances and viewport parameters, and renders those layers as a transparent overlay.

```bash
npm install @deck.gl/core @deck.gl/layers
```

```js
import {Deck} from '@deck.gl/core';
import {ScatterplotLayer} from '@deck.gl/layers';

const INITIAL_VIEW_STATE = {
  latitude: 37.8,
  longitude: -122.45,
  zoom: 15
};

const deckgl = new Deck({
  initialViewState: INITIAL_VIEW_STATE,
  controller: true,
  layers: [
    new ScatterplotLayer({
      data: [
        {position: [-122.45, 37.8], color: [255, 0, 0], radius: 100}
      ],
      getColor: d => d.color,
      getRadius: d => d.radius
    })
  ]
});
```

## Using the Scripting API

deck.gl also offers a standalone bundled version of the library - a native JavaScript scripting interface like that of d3.js. You can now use deck.gl in prototype environments such as [Codepen](https://codepen.io), [JSFiddle](https://jsfiddle.net) and [Observable](https://observablehq.com). This effort aims to make it easier for designers, creative coders and data scientists everywhere to leverage WebGL for interactive visualizations.

To use deck.gl in a scripting environment, include the standalone version in a `script` tag:

```html
<script src="https://unpkg.com/deck.gl@latest/dist.min.js"></script>
<!-- optional if WebGL constants are needed -->
<script src="https://unpkg.com/@luma.gl/constants@latest/dist/dist.min.js"></script>
<!-- optional if mapbox base map is needed -->
<script src='https://api.tiles.mapbox.com/mapbox-gl-js/v0.53.0/mapbox-gl.js'></script>
<link href='https://api.tiles.mapbox.com/mapbox-gl-js/v0.53.0/mapbox-gl.css' rel='stylesheet' />
```

It exposes two global objects `deck` and `luma`. Any exports from the deck.gl core can be accessed by `deck.<Class>`. WebGL constants can be accessed by `luma.GL.<constant>`.

The scripting API's [DeckGL](/docs/api-reference/core/deckgl.md) class extends the core `Deck` class with some additional features such as Mapbox integration.

```js
new deck.DeckGL({
  mapStyle: 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json',
  initialViewState: {
    longitude: -122.45,
    latitude: 37.8,
    zoom: 15
  },
  controller: true,
  layers: [
    new deck.ScatterplotLayer({
      data: [
        {position: [-122.45, 37.8], color: [255, 0, 0], radius: 100}
      ],
      getColor: d => d.color,
      getRadius: d => d.radius
    })
  ]
});
```

Check our codepen [showcase](https://codepen.io/vis-gl) and [observable profile](https://beta.observablehq.com/@pessimistress) for examples.
