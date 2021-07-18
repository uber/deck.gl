import {loadArcGISModules} from '@deck.gl/arcgis';
import {GeoJsonLayer, ArcLayer} from '@deck.gl/layers';
import {_GlobeView as GlobeView} from '@deck.gl/core';

// source: Natural Earth http://www.naturalearthdata.com/ via geojson.xyz
const AIR_PORTS =
  'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_10m_airports.geojson';

loadArcGISModules(['esri/Map', 'esri/views/SceneView', 'esri/views/3d/externalRenderers']).then(
  ({DeckRenderer, modules}) => {
    const [ArcGISMap, SceneView, externalRenderers] = modules;

    // In the ArcGIS API for JavaScript the SceneView is responsible
    // for displaying a Map, which usually contains at least a basemap.
    // eslint-disable-next-line
    const sceneView = new SceneView({
      container: 'viewDiv',
      map: new ArcGISMap({
        basemap: 'dark-gray-vector',
        layers: []
      }),
      center: [0.119167, 52.205276],
      zoom: 5,
      // disable sun, because DeckRenderer renders above the globe
      environment: {
        lighting: {
          date: new Date('null')
        }
      }
    });
    sceneView.on('drag', event => {
      // right-click
      if (event.button === 2) {
        // disable tilt + rotation, because it's unsupported by deck.gl GlobeView
        event.stopPropagation();
      }
    });

    const renderer = new DeckRenderer(sceneView, {
      getTooltip: info => info.object && info.object.properties.name,
      views: [new GlobeView()],
      layers: [
        new GeoJsonLayer({
          id: 'airports',
          data: AIR_PORTS,
          // Styles
          filled: true,
          pointRadiusMinPixels: 2,
          pointRadiusScale: 2000,
          getRadius: f => 11 - f.properties.scalerank,
          getFillColor: [200, 0, 80, 180],
          // Interactive props
          pickable: true,
          autoHighlight: true,
          onClick: info =>
            info.object &&
            // eslint-disable-next-line
            alert(`${info.object.properties.name} (${info.object.properties.abbrev})`),
          parameters: {
            cull: true
          }
        }),
        new ArcLayer({
          id: 'arcs',
          data: AIR_PORTS,
          dataTransform: d => d.features.filter(f => f.properties.scalerank < 4),
          // Styles
          getSourcePosition: f => [-0.4531566, 51.4709959], // London
          getTargetPosition: f => f.geometry.coordinates,
          getSourceColor: [0, 128, 200],
          getTargetColor: [200, 0, 80],
          getWidth: 1,
          parameters: {
            cull: true
          }
        }),
        new GeoJsonLayer({
          id: 'land',
          data: 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_land.geojson',
          filled: false,
          getLineColor: [255, 255, 255, 127],
          getLineWidth: 1,
          lineWidthUnits: 'pixels',
          parameters: {
            cull: true
          }
        })
      ]
    });
    externalRenderers.add(sceneView, renderer);
  }
);
