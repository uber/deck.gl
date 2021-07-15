/* global document, google, window */
import {GoogleMapsOverlay as DeckOverlay} from '@deck.gl/google-maps';
import {ScenegraphLayer} from '@deck.gl/mesh-layers';
import {registerLoaders} from '@loaders.gl/core';
import {GLTFLoader} from '@loaders.gl/gltf';

import * as dataSamples from '../../../layer-browser/src/data-samples';

registerLoaders([GLTFLoader]);

const GOOGLE_MAP_ID = 'fae05836df2dc8bb';
// const GOOGLE_MAP_ID = 'e0cde073740a00d5';

// Set your Google Maps API key here or via environment variable
const GOOGLE_MAPS_API_KEY = process.env.GoogleMapsAPIKey; // eslint-disable-line
const GOOGLE_MAPS_API_URL = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=beta&map_ids=${GOOGLE_MAP_ID}`;

function loadScript(url) {
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = url;
  const head = document.querySelector('head');
  head.appendChild(script);
  return new Promise(resolve => {
    script.onload = resolve;
  });
}

const center = {lat: 37.79200903435449, lng: -122.40333859851314};

loadScript(GOOGLE_MAPS_API_URL).then(() => {
  const map = new google.maps.Map(document.getElementById('map'), {
    center,
    tilt: 45,
    bearing: 0,
    zoom: 17,
    mapId: GOOGLE_MAP_ID
  });
  window.map = map;

  const props = {
    id: 'scenegraph-layer',
    data: dataSamples.points.filter(p => {
      return (
        Math.abs(p.COORDINATES[0] - center.lng) < 0.002 &&
        Math.abs(p.COORDINATES[1] - center.lat) < 0.002
      );
    }),
    pickable: true,
    sizeScale: 1,
    scenegraph:
      'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb',
    getPosition: d => d.COORDINATES,
    getOrientation: d => [0, Math.random() * 360, 90],
    getScale: d => {
      const s = 5 + 30 * Math.random();
      return [s, s, s];
    },
    _lighting: 'pbr'
  };

  const overlay = new DeckOverlay({
    layers: [new ScenegraphLayer(props)],

    getTooltip: ({object}) => {
      return (
        object && {
          html: `<strong>Address</strong>: ${object.ADDRESS}<br/>`
        }
      );
    }
  });
  overlay.setMap(map);
});
