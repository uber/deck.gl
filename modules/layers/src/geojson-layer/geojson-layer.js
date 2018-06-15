// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import {CompositeLayer} from '@deck.gl/core';
import ScatterplotLayer from '../scatterplot-layer/scatterplot-layer';
import PathLayer from '../path-layer/path-layer';
// Use primitive layer to avoid "Composite Composite" layers for now
import SolidPolygonLayer from '../solid-polygon-layer/solid-polygon-layer';

import {getGeojsonFeatures, separateGeojsonFeatures} from './geojson';

const defaultLineColor = [0x0, 0x0, 0x0, 0xff];
const defaultFillColor = [0x0, 0x0, 0x0, 0xff];

const defaultProps = {
  stroked: true,
  filled: true,
  extruded: false,
  wireframe: false,

  lineWidthScale: 1,
  lineWidthMinPixels: 0,
  lineWidthMaxPixels: Number.MAX_SAFE_INTEGER,
  lineJointRounded: false,
  lineMiterLimit: 4,

  elevationScale: 1,

  pointRadiusScale: 1,
  pointRadiusMinPixels: 0, //  min point radius in pixels
  pointRadiusMaxPixels: Number.MAX_SAFE_INTEGER, // max point radius in pixels

  lineDashJustified: false,
  fp64: false,

  // Line and polygon outline color
  getLineColor: f => (f.properties && f.properties.lineColor) || defaultLineColor,
  // Point and polygon fill color
  getFillColor: f => (f.properties && f.properties.fillColor) || defaultFillColor,
  // Point radius
  getRadius: f => (f.properties && (f.properties.radius || f.properties.size)) || 1,
  // Line and polygon outline accessors
  getLineWidth: f => (f.properties && f.properties.lineWidth) || 1,
  // Line dash array accessor
  getLineDashArray: null,
  // Polygon extrusion accessor
  getElevation: f => (f.properties && f.properties.elevation) || 1000,

  subLayers: {
    PointLayer: ScatterplotLayer,
    LineLayer: PathLayer,
    PolygonLayer: SolidPolygonLayer
  },

  // Optional settings for 'lighting' shader module
  lightSettings: {}
};

const getCoordinates = f => f.geometry.coordinates;

export default class GeoJsonLayer extends CompositeLayer {
  initializeState() {
    this.state = {
      features: {}
    };
  }

  updateState({oldProps, props, changeFlags}) {
    if (changeFlags.dataChanged) {
      const {data} = props;
      const features = getGeojsonFeatures(data);
      this.state.features = separateGeojsonFeatures(features);
    }
  }

  getPickingInfo({info, sourceLayer}) {
    // `info.index` is the index within the particular sub-layer
    // We want to expose the index of the feature the user provided
    let featureIndex = info.index;

    if (sourceLayer.id === this.getSubLayerProps({id: 'points'}).id) {
      featureIndex = this.state.features.pointFeatureIndexes[info.index];
    } else if (sourceLayer.id === this.getSubLayerProps({id: 'line-paths'}).id) {
      featureIndex = this.state.features.lineFeatureIndexes[info.index];
    } else if (sourceLayer.id === this.getSubLayerProps({id: 'polygon-fill'}).id) {
      featureIndex = this.state.features.polygonFeatureIndexes[info.index];
    } else if (sourceLayer.id === this.getSubLayerProps({id: 'polygon-outline'}).id) {
      featureIndex = this.state.features.polygonOutlineFeatureIndexes[info.index];
    }

    return Object.assign(info, {
      // override object with picked feature
      object: (info.object && info.object.__deckSourceFeature) || info.object,
      index: featureIndex
    });
  }

  /* eslint-disable complexity */
  renderLayers() {
    const {features} = this.state;
    const {pointFeatures, lineFeatures, polygonFeatures, polygonOutlineFeatures} = features;

    // Layer composition props
    const {stroked, filled, extruded, wireframe, subLayers, lightSettings} = this.props;

    // Rendering props underlying layer
    const {
      lineWidthScale,
      lineWidthMinPixels,
      lineWidthMaxPixels,
      lineJointRounded,
      lineMiterLimit,
      pointRadiusScale,
      pointRadiusMinPixels,
      pointRadiusMaxPixels,
      elevationScale,
      lineDashJustified,
      fp64
    } = this.props;

    // Accessor props for underlying layers
    const {
      getLineColor,
      getFillColor,
      getRadius,
      getLineWidth,
      getLineDashArray,
      getElevation,
      updateTriggers
    } = this.props;

    const drawPoints = pointFeatures && pointFeatures.length > 0;
    const drawLines = lineFeatures && lineFeatures.length > 0;
    const hasPolygonLines = polygonOutlineFeatures && polygonOutlineFeatures.length > 0;
    const hasPolygon = polygonFeatures && polygonFeatures.length > 0;

    // Filled Polygon Layer
    const polygonFillLayer =
      hasPolygon &&
      new subLayers.PolygonLayer(
        this.getSubLayerProps({
          id: 'polygon-fill',
          updateTriggers: {
            getElevation: updateTriggers.getElevation,
            getFillColor: updateTriggers.getFillColor,
            getLineColor: updateTriggers.getLineColor
          }
        }),
        {
          data: polygonFeatures,
          fp64,
          extruded,
          elevationScale,
          filled,
          wireframe,
          lightSettings,
          getPolygon: getCoordinates,
          getElevation,
          getFillColor,
          getLineColor
        }
      );

    const polygonLineLayer =
      !extruded &&
      stroked &&
      hasPolygonLines &&
      new subLayers.LineLayer(
        this.getSubLayerProps({
          id: 'polygon-outline',
          updateTriggers: {
            getColor: updateTriggers.getLineColor,
            getWidth: updateTriggers.getLineWidth,
            getDashArray: updateTriggers.getLineDashArray
          }
        }),
        {
          data: polygonOutlineFeatures,

          fp64,
          widthScale: lineWidthScale,
          widthMinPixels: lineWidthMinPixels,
          widthMaxPixels: lineWidthMaxPixels,
          rounded: lineJointRounded,
          miterLimit: lineMiterLimit,
          dashJustified: lineDashJustified,

          getPath: getCoordinates,
          getColor: getLineColor,
          getWidth: getLineWidth,
          getDashArray: getLineDashArray
        }
      );

    const pathLayer =
      drawLines &&
      new subLayers.LineLayer(
        this.getSubLayerProps({
          id: 'line-paths',
          updateTriggers: {
            getColor: updateTriggers.getLineColor,
            getWidth: updateTriggers.getLineWidth
          }
        }),
        {
          data: lineFeatures,

          fp64,
          widthScale: lineWidthScale,
          widthMinPixels: lineWidthMinPixels,
          widthMaxPixels: lineWidthMaxPixels,
          rounded: lineJointRounded,
          miterLimit: lineMiterLimit,

          getPath: getCoordinates,
          getColor: getLineColor,
          getWidth: getLineWidth
        }
      );

    const pointLayer =
      drawPoints &&
      new subLayers.PointLayer(
        this.getSubLayerProps({
          id: 'points',
          updateTriggers: {
            getColor: updateTriggers.getFillColor,
            getRadius: updateTriggers.getRadius
          }
        }),
        {
          data: pointFeatures,

          fp64,
          radiusScale: pointRadiusScale,
          radiusMinPixels: pointRadiusMinPixels,
          radiusMaxPixels: pointRadiusMaxPixels,

          getPosition: getCoordinates,
          getColor: getFillColor,
          getRadius
        }
      );

    return [
      // If not extruded: flat fill layer is drawn below outlines
      !extruded && polygonFillLayer,
      polygonLineLayer,
      pathLayer,
      pointLayer,
      // If extruded: draw fill layer last for correct blending behavior
      extruded && polygonFillLayer
    ];
  }
  /* eslint-enable complexity */
}

GeoJsonLayer.layerName = 'GeoJsonLayer';
GeoJsonLayer.defaultProps = defaultProps;
