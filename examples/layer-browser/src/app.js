/* global window */

// deck.gl ES6 components
import {
  COORDINATE_SYSTEM,
  MapView,
  FirstPersonView,
  OrbitView,
  AmbientLight,
  DirectionalLight,
  LightingEffect
} from '@deck.gl/core';

import React, {PureComponent} from 'react';
import autobind from 'react-autobind';

import {Matrix4} from 'math.gl';

import LayerSelector from './components/layer-selector';
import LayerControls from './components/layer-controls';

import LAYER_CATEGORIES from './examples';
import Map from './map';

const AMBIENT_LIGHT = new AmbientLight({
  color: [255, 255, 255],
  intensity: 1.2
});

const DIRECTIONAL_LIGHT = new DirectionalLight({
  color: [255, 255, 255],
  intensity: 3.0,
  direction: [-3, -9, -1]
});

const GLOBAL_LIGHTING = new LightingEffect({
  AMBIENT_LIGHT,
  DIRECTIONAL_LIGHT
});

// ---- View ---- //
export default class App extends PureComponent {
  constructor(props) {
    super(props);
    autobind(this);

    this.state = props.state || {
      activeExamples: {
        ScatterplotLayer: true
      },
      settings: {
        orthographic: false,
        multiview: false,
        infovis: false,
        useDevicePixels: true,
        pickingRadius: 0,
        drawPickingColors: false,

        // Model matrix manipulation
        separation: 0,
        rotationZ: 0,
        rotationX: 0

        // immutable: false,
        // Effects are experimental for now. Will be enabled in the future
        // effects: false,
      },

      enableDepthPickOnClick: false
    };

    this.mapRef = React.createRef();
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState !== this.state) {
      this.props.onStateChange(this.state);
    }
  }

  _getSize() {
    return {width: window.innerWidth, height: window.innerHeight};
  }

  _onToggleLayer(exampleName, example) {
    const activeExamples = {...this.state.activeExamples};
    activeExamples[exampleName] = !activeExamples[exampleName];
    this.setState({activeExamples});
  }

  _onUpdateLayerSettings(exampleName, settings) {
    const activeExamples = {...this.state.activeExamples};
    activeExamples[exampleName] = {
      ...activeExamples[exampleName],
      ...settings
    };
    this.setState({activeExamples});
  }

  _onUpdateContainerSettings(settings) {
    this.setState({settings});
  }

  _onPickObjects() {
    const {width, height} = this._getSize();
    this.mapRef.current.pickObjects({x: 0, y: 0, width, height});
  }

  _multiDepthPick(x, y) {
    this.mapRef.current.pickMultipleObjects({x, y});
  }

  _renderExampleLayer(example, settings, index) {
    const {layer: Layer, props, getData, initialize, isInitialized} = example;

    if (getData && !props.data) {
      props.data = getData();
    }

    if (initialize && !isInitialized) {
      initialize();
      example.isInitialized = true;
    }

    const layerProps = Object.assign({}, props, settings);
    Object.assign(layerProps, {
      modelMatrix: this._getModelMatrix(index, layerProps.coordinateSystem)
    });

    return new Layer(layerProps);
  }

  /* eslint-disable max-depth */
  _renderExamples() {
    let index = 1;
    const layers = [];
    const {activeExamples} = this.state;

    for (const categoryName of Object.keys(LAYER_CATEGORIES)) {
      for (const exampleName of Object.keys(LAYER_CATEGORIES[categoryName])) {
        const settings = activeExamples[exampleName];
        // An example is a function that returns a DeckGL layer instance
        if (settings) {
          const example = LAYER_CATEGORIES[categoryName][exampleName];
          const layer = this._renderExampleLayer(example, settings, index++);

          if (typeof settings !== 'object') {
            activeExamples[exampleName] = LayerControls.getSettings(layer.props);
          }

          layers.push(layer);
        }
      }
    }
    return layers;
  }
  /* eslint-enable max-depth */

  _getModelMatrix(index, coordinateSystem) {
    const {
      settings: {separation}
    } = this.state;
    const modelMatrix = new Matrix4().translate([0, 0, 5 * index * separation]);

    switch (coordinateSystem) {
      case COORDINATE_SYSTEM.METER_OFFSETS:
      case COORDINATE_SYSTEM.IDENTITY:
        const {
          settings: {rotationZ, rotationX}
        } = this.state;
        modelMatrix.rotateZ(index * rotationZ * Math.PI);
        modelMatrix.rotateX(index * rotationX * Math.PI);
        break;
      default:
      // Rotations don't work well for layers in lng lat coordinates
      // since the origin is far away.
      // We could rotate around current view point...
    }

    return modelMatrix;
  }

  _getViews() {
    const {infovis, multiview, orthographic} = this.state.settings;
    let views;

    if (infovis) {
      views = new OrbitView({
        id: 'infovis',
        controller: true,
        fov: 50,
        minZoom: 0,
        maxZoom: 20
      });
    } else if (multiview) {
      views = [
        new FirstPersonView({id: 'first-person', height: '50%', position: [0, 0, 50]}),
        new MapView({
          id: 'basemap',
          controller: true,
          y: '50%',
          height: '50%',
          position: [0, 0, 0],
          orthographic
        })
      ];
    } else {
      views = new MapView({id: 'basemap', controller: true, position: [0, 0, 0], orthographic});
    }
    return views;
  }

  _getEffects() {
    // TODO
    // const {effects} = this.state.settings;

    return [GLOBAL_LIGHTING];
  }

  render() {
    const {settings, activeExamples} = this.state;

    return (
      <div>
        <Map
          ref={this.mapRef}
          layers={this._renderExamples()}
          views={this._getViews()}
          effects={this._getEffects()}
          settings={settings}
        />
        <div id="control-panel">
          <div style={{textAlign: 'center', padding: '5px 0 5px'}}>
            <button onClick={this._onPickObjects}>
              <b>Pick Objects</b>
            </button>
            <button
              onClick={() =>
                this.setState({enableDepthPickOnClick: !this.state.enableDepthPickOnClick})
              }
            >
              <b>Multi Depth Pick ({this.state.enableDepthPickOnClick ? 'ON' : 'OFF'})</b>
            </button>
          </div>
          <LayerControls
            title="Common Settings"
            settings={settings}
            onChange={this._onUpdateContainerSettings}
          />
          <LayerSelector
            activeExamples={activeExamples}
            examples={LAYER_CATEGORIES}
            onToggleLayer={this._onToggleLayer}
            onUpdateLayer={this._onUpdateLayerSettings}
          />
        </div>
      </div>
    );
  }
}
