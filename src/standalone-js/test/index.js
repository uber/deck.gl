/* global deck, document */
/* eslint-disable no-unused-vars */
import '../src';
import {choropleths} from '../../../examples/layer-browser/src/data-samples';

const SAMPLE_SIZE = 10;
const points = [];

for (let x = 0; x < SAMPLE_SIZE; x++) {
  for (let y = 0; y < SAMPLE_SIZE; y++) {
    for (let z = 0; z < SAMPLE_SIZE; z++) {
      points.push({
        position: [x - SAMPLE_SIZE / 2, y - SAMPLE_SIZE / 2, z - SAMPLE_SIZE / 2],
        color: [x / SAMPLE_SIZE * 255, y / SAMPLE_SIZE * 255, z / SAMPLE_SIZE * 255]
      });
    }
  }
}

const geoExample = new deck.Deck({
  mapboxApiAccessToken: __MAPBOX_TOKEN__, // eslint-disable-line
  container: document.getElementById('geo'),
  longitude: -122.45,
  latitude: 37.78,
  zoom: 11,
  pitch: 30,
  layers: [
    new deck.GeoJsonLayer({
      data: choropleths,
      extruded: true,
      wireframe: true,
      fp64: true,
      getElevation: d => d.properties.OBJECTID * 100,
      getLineColor: d => [255, 255, 255],
      getFillColor: d => [0, 50, 100]
    })
  ]
});

const nonGeoExample = new deck.Deck({
  container: document.getElementById('non-geo'),
  mapbox: false /* disable map */,
  views: [new deck.OrbitView()],
  viewState: {distance: 1, rotationX: 45, rotationOrbit: 30, zoom: 0.05},
  layers: [
    new deck.PointCloudLayer({
      id: 'pointCloud',
      coordinateSystem: deck.COORDINATE_SYSTEM.IDENTITY,
      opacity: 1,
      data: points,
      getNormal: d => [0, 0, 1],
      radiusPixels: 10,
      lightSettings: {
        coordinateSystem: deck.COORDINATE_SYSTEM.IDENTITY,
        lightsPosition: [100, 100, 100]
      }
    })
  ]
});
