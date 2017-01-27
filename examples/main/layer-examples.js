import {
  ScatterplotLayer,
  ArcLayer,
  LineLayer,
  HexagonLayer,

  ScreenGridLayer,
  IconLayer,
  GridLayer,
  GeoJsonLayer,
  // PolygonLayer,
  // PathLayer,

  ScatterplotLayer64,
  ArcLayer64,
  LineLayer64,

  ChoroplethLayer,
  ChoroplethLayer64,
  ExtrudedChoroplethLayer64

  // Container
} from 'deck.gl';

import * as dataSamples from './data-samples';
import {parseColor, setOpacity} from '../../src/lib/utils/color';

// Demonstrate immutable support
import Immutable from 'immutable';
const immutableChoropleths = Immutable.fromJS(dataSamples.choropleths);

const MARKER_SIZE_MAP = {
  small: 2,
  medium: 5,
  large: 10
};

const ArcLayerExample = {
  layer: ArcLayer,
  props: {
    id: 'arcLayer',
    data: dataSamples.routes,
    getSourcePosition: d => d.START,
    getTargetPosition: d => d.END,
    getSourceColor: d => [64, 255, 0],
    getTargetColor: d => [0, 128, 200],
    strokeWidth: 1,
    pickable: true
  }
};

const IconLayerExample = {
  layer: IconLayer,
  props: {
    iconAtlas: 'data/icon-atlas.png',
    iconMapping: dataSamples.iconAtlas,
    data: dataSamples.points,
    size: 24,
    getPosition: d => d.COORDINATES,
    getColor: d => [64, 64, 72],
    getIcon: d => d.PLACEMENT === 'SW' ? 'marker' : 'marker-warning',
    getScale: d => d.RACKS > 2 ? 2 : 1,
    opacity: 0.8,
    pickable: true
  }
};

const GeoJsonLayerExample = {
  layer: GeoJsonLayer,
  props: {
    id: 'geojsonLayer',
    data: dataSamples.geojson,
    // TODO change to use the color util when it is landed
    getPointColor: f => parseColor(f.properties['marker-color']),
    getPointSize: f => MARKER_SIZE_MAP[f.properties['marker-size']],
    getStrokeColor: f => {
      const color = parseColor(f.properties.stroke);
      const opacity = f.properties['stroke-opacity'] * 255;
      return setOpacity(color, opacity);
    },
    getStrokeWidth: f => f.properties['stroke-width'],
    getFillColor: f => {
      const color = parseColor(f.properties.fill);
      const opacity = f.properties['fill-opacity'] * 255;
      return setOpacity(color, opacity);
    },
    strokeWidth: 10,
    strokeMinPixels: 1,
    pickable: true
  }
};

const GeoJsonLayerExtrudedExample = {
  layer: GeoJsonLayer,
  props: {
    id: 'geojsonLayer-example',
    data: dataSamples.choropleths,
    getHeight: f => ((f.properties.ZIP_CODE * 10) % 127) * 10,
    getFillColor: f => [0, 0, ((f.properties.ZIP_CODE * 23) % 100) + 155],
    drawPolygons: true,
    extruded: true,
    pickable: true
  }
};

const GeoJsonLayerWireframeExample = {
  layer: GeoJsonLayer,
  props: {
    id: 'geojsonLayer-wireframe',
    data: dataSamples.choropleths,
    fillPolygons: false,
    extruded: true,
    wireframe: true,
    lightSettings: {enabled: false},
    getHeight: f => ((f.properties.ZIP_CODE * 10) % 127) * 10,
    getStrokeColor: f => [200, 0, 80]
  }
};

// const GeoJsonLayerImmutableExample = {
//   layer: GeoJsonLayer,
//   props: {
//     id: 'geojsonLayer-immutable',
//     data: immutableChoropleths,
//     getFillColor: f => [0, ((Container.get(f, 'properties.ZIP_CODE') * 10) % 127) * 2, 128],
//     getColor: f => [200, 0, 80],
//     opacity: 0.8,
//     drawContour: true
//   }
// };

// const PolygonLayerExample = {
//   layer: PolygonLayer,
//   props: {
//     data: dataSamples.polygons,
//     getColor: f => [((f.properties.ZIP_CODE * 10) % 127) + 128, 0, 0],
//     opacity: 0.8,
//     pickable: true
//   }
// };

// const PathLayerExample = {
//   layer: ChoroplethLayer,
//   props: {
//     id: 'choroplethLayerSolid',
//     data: dataSamples.polygons,
//     getColor: f => [((f.properties.ZIP_CODE * 10) % 127) + 128, 0, 0],
//     opacity: 0.8,
//     pickable: true
//   }
// };

const ScreenGridLayerExample = {
  layer: ScreenGridLayer,
  props: {
    id: 'screenGridLayer',
    data: dataSamples.points,
    getPosition: d => d.COORDINATES,
    unitWidth: 40,
    unitHeight: 40,
    minColor: [0, 0, 80, 0],
    maxColor: [100, 255, 0, 128],
    pickable: false
  }
};

const LineLayerExample = {
  layer: LineLayer,
  props: {
    id: 'lineLayer',
    data: dataSamples.routes,
    getSourcePosition: d => d.START,
    getTargetPosition: d => d.END,
    getColor: d => d.SERVICE === 'WEEKDAY' ? [255, 64, 0] : [255, 200, 0],
    strokeWidth: 1,
    pickable: true
  }
};

const ScatterplotLayerExample = {
  layer: ScatterplotLayer,
  props: {
    id: 'scatterplotLayer',
    data: dataSamples.points,
    getPosition: d => d.COORDINATES,
    getColor: d => [255, 128, 0],
    getRadius: d => d.SPACES,
    opacity: 0.5,
    strokeWidth: 2,
    pickable: true,
    radiusMinPixels: 1,
    radiusMaxPixels: 30
  }
};

const ScatterplotLayerMetersExample = {
  layer: ScatterplotLayer,
  props: {
    id: 'scatterplotLayerMeter',
    data: dataSamples.meterPoints,
    drawOutline: true,
    projectionMode: 2,
    positionOrigin: dataSamples.positionOrigin,
    getPosition: d => d,
    getColor: d => [0, 0, 255],
    opacity: 0.5,
    pickable: true
  }
};

const GridLayerExample = {
  layer: GridLayer,
  props: {
    id: 'gridLayer',
    data: dataSamples.worldGrid.data,
    latDelta: dataSamples.worldGrid.latDelta,
    lngDelta: dataSamples.worldGrid.lngDelta,
    getColor: g => [245, 166, g.value * 255],
    getElevation: h => h.value * 50,
    enable3d: true,
    pickable: true,
    opacity: 1
  }
};

const HexagonLayerExample = {
  layer: HexagonLayer,
  props: {
    id: 'hexagonLayer',
    data: dataSamples.hexagons,
    hexagonVertices: dataSamples.hexagons[0].vertices,
    getColor: h => [48, 128, h.value * 255],
    getElevation: h => h.value * 50,
    enable3d: true,
    pickable: true,
    opacity: 1
  }
};

// 64 BIT LAYER EXAMPLES

const ArcLayer64Example = {
  layer: ArcLayer64,
  props: {
    id: 'arcLayer64',
    data: dataSamples.routes,
    getSourcePosition: d => d.START,
    getTargetPosition: d => d.END,
    getSourceColor: d => [64, 255, 0],
    getTargetColor: d => [0, 128, 200],
    strokeWidth: 1,
    pickable: true
  }
};

const LineLayer64Example = {
  layer: LineLayer64,
  props: {
    id: 'lineLayer64',
    data: dataSamples.routes,
    getSourcePosition: d => d.START,
    getTargetPosition: d => d.END,
    getColor: d => d.SERVICE === 'WEEKDAY' ? [255, 64, 0] : [255, 200, 0],
    strokeWidth: 1,
    pickable: true
  }
};

const ScatterplotLayer64Example = {
  layer: ScatterplotLayer64,
  props: {
    id: 'scatterplotLayer64',
    data: dataSamples.points,
    getPosition: d => d.COORDINATES,
    getColor: d => [255, 128, 0],
    getRadius: d => d.SPACES,
    pickable: true,
    radiusMinPixels: 1,
    radiusMaxPixels: 30
  }
};

const ChoroplethLayerContourExample = {
  layer: ChoroplethLayer,
  props: {
    id: 'choroplethLayerContour',
    data: immutableChoropleths,
    getColor: f => [0, 80, 200],
    opacity: 0.8,
    drawContour: true
  }
};

const ChoroplethLayerExample = {
  layer: ChoroplethLayer,
  props: {
    id: 'choroplethLayerSolid',
    data: dataSamples.choropleths,
    getColor: f => [((f.properties.ZIP_CODE * 10) % 127) + 128, 0, 0],
    opacity: 0.8,
    pickable: true
  }
};

const ChoroplethLayer64ContourExample = {
  layer: ChoroplethLayer64,
  props: {
    id: 'choroplethLayer64Contour',
    data: dataSamples.choropleths,
    getColor: f => [0, 80, 200],
    opacity: 0.8,
    drawContour: true
  }
};

const ChoroplethLayer64SolidExample = {
  layer: ChoroplethLayer64,
  props: {
    id: 'choroplethLayer64Solid',
    data: dataSamples.choropleths,
    getColor: f => [((f.properties.ZIP_CODE * 10) % 127) + 128, 0, 0],
    opacity: 0.8,
    pickable: true
  }
};

const ExtrudedChoroplethLayer64Example = {
  layer: ExtrudedChoroplethLayer64,
  props: {
    id: 'extrudedChoroplethLayer64',
    data: dataSamples.choropleths,
    getColor: f => [((f.properties.ZIP_CODE * 10) % 127) + 128, 0, 0],
    pointLightLocation: [
      // props.mapViewState.longitude,
      // props.mapViewState.latitude,
      37.751537058389985,
      -122.42694203247012,
      1e4
    ],
    opacity: 1.0,
    pickable: true
  }
};

const ExtrudedChoroplethLayer64WireframeExample = {
  layer: ExtrudedChoroplethLayer64,
  props: Object.assign({}, ExtrudedChoroplethLayer64Example.props, {
    id: 'extrudedChoroplethLayer64-wireframe',
    drawWireframe: true
  })
};

// perf test examples
const ScatterplotLayerPerfExample = (id, getData) => ({
  layer: ScatterplotLayer,
  getData,
  props: {
    id: `scatterplotLayerPerf-${id}`,
    getPosition: d => d,
    getColor: d => [0, 128, 0],
    // pickable: true,
    radiusMinPixels: 1,
    radiusMaxPixels: 5
  }
});

const ScatterplotLayer64PerfExample = (id, getData) => ({
  layer: ScatterplotLayer64,
  getData,
  props: {
    id: `scatterplotLayer64Perf-${id}`,
    getPosition: d => d,
    getColor: d => [0, 128, 0],
    // pickable: true,
    radiusMinPixels: 1,
    radiusMaxPixels: 5
  }
});

/* eslint-disable quote-props */
export default {
  'Core Layers': {
    'GeoJsonLayer': GeoJsonLayerExample,
    'GeoJsonLayer (Extruded)': GeoJsonLayerExtrudedExample,
    'GeoJsonLayer (Wireframe)': GeoJsonLayerWireframeExample,
    // 'GeoJsonLayer (Immutable)': GeoJsonLayerImmutableExample,
    // PolygonLayer: PolygonLayerExample,
    // PathLayer: PathLayerExample,
    'ScatterplotLayer': ScatterplotLayerExample,
    'ScatterplotLayer (meters)': ScatterplotLayerMetersExample,
    ArcLayer: ArcLayerExample,
    LineLayer: LineLayerExample,
    ScreenGridLayer: ScreenGridLayerExample,
    GridLayer: GridLayerExample,
    HexagonLayer: HexagonLayerExample,
    IconLayer: IconLayerExample
  },

  '64-bit Layers': {
    ArcLayer64: ArcLayer64Example,
    ScatterplotLayer64: ScatterplotLayer64Example,
    LineLayer64: LineLayer64Example
  },

  'Deprecated Layers': {
    'ChoroplethLayer (Solid)': ChoroplethLayerExample,
    'ChoroplethLayer (Contour)': ChoroplethLayerContourExample,
    'ChoroplethLayer64 (Solid)': ChoroplethLayer64SolidExample,
    'ChoroplethLayer64 (Contour)': ChoroplethLayer64ContourExample,
    'ExtrudedChoroplethLayer64': ExtrudedChoroplethLayer64Example,
    'ExtrudedChoroplethLayer64 (Wireframe)': ExtrudedChoroplethLayer64WireframeExample
  },

  'Performance Tests': {
    'ScatterplotLayer 1M': ScatterplotLayerPerfExample('1M', dataSamples.getPoints1M),
    'ScatterplotLayer 10M': ScatterplotLayerPerfExample('10M', dataSamples.getPoints10M),
    'ScatterplotLayer64 100K': ScatterplotLayer64PerfExample('100K', dataSamples.getPoints100K),
    'ScatterplotLayer64 1M': ScatterplotLayer64PerfExample('1M', dataSamples.getPoints1M),
    'ScatterplotLayer64 10M': ScatterplotLayer64PerfExample('10M', dataSamples.getPoints10M)
  }
};
