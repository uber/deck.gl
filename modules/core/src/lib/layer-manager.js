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

import assert from '../utils/assert';
import {Timeline} from '@luma.gl/core';
import Layer from './layer';
import {LIFECYCLE} from '../lifecycle/constants';
import log from '../utils/log';
import debug from '../debug';
const debugLog = debug.log;
import {flatten} from '../utils/flatten';
import {Stats} from 'probe.gl';

import Viewport from '../viewports/viewport';
import {createProgramManager} from '../shaderlib';

const EVENT_SET_LAYERS = 'layerManager.setLayers';
const EVENT_ACTIVATE_VIEWPORT = 'layerManager.activateViewport';

// CONTEXT IS EXPOSED TO LAYERS
const INITIAL_CONTEXT = Object.seal({
  layerManager: null,
  deck: null,
  gl: null,

  // General resources
  stats: null, // for tracking lifecycle performance

  // GL Resources
  shaderCache: null,
  pickingFBO: null, // Screen-size framebuffer that layers can reuse

  mousePosition: null,

  userData: {} // Place for any custom app `context`
});

const layerName = layer => (layer instanceof Layer ? `${layer}` : !layer ? 'null' : 'invalid');

export default class LayerManager {
  // eslint-disable-next-line
  constructor(gl, {deck, stats, viewport = null, timeline = null} = {}) {
    // Currently deck.gl expects the DeckGL.layers array to be different
    // whenever React rerenders. If the same layers array is used, the
    // LayerManager's diffing algorithm will generate a fatal error and
    // break the rendering.

    // `this.lastRenderedLayers` stores the UNFILTERED layers sent
    // down to LayerManager, so that `layers` reference can be compared.
    // If it's the same across two React render calls, the diffing logic
    // will be skipped.
    this.lastRenderedLayers = [];
    this.layers = [];

    this.context = Object.assign({}, INITIAL_CONTEXT, {
      layerManager: this,
      deck,
      gl,
      // Enabling luma.gl Program caching using private API (_cachePrograms)
      programManager: gl && createProgramManager(gl),
      stats: stats || new Stats({id: 'deck.gl'}),
      // Make sure context.viewport is not empty on the first layer initialization
      viewport: viewport || new Viewport({id: 'DEFAULT-INITIAL-VIEWPORT'}), // Current viewport, exposed to layers for project* function
      timeline: timeline || new Timeline()
    });

    this._needsRedraw = 'Initial render';
    this._needsUpdate = false;
    this._debug = false;

    this.activateViewport = this.activateViewport.bind(this);

    Object.seal(this);
  }

  // Method to call when the layer manager is not needed anymore.
  finalize() {
    // Finalize all layers
    for (const layer of this.layers) {
      this._finalizeLayer(layer);
    }
  }

  // Check if a redraw is needed
  needsRedraw(opts = {clearRedrawFlags: false}) {
    return this._checkIfNeedsRedraw(opts);
  }

  // Check if a deep update of all layers is needed
  needsUpdate() {
    return this._needsUpdate;
  }

  // Layers will be redrawn (in next animation frame)
  setNeedsRedraw(reason) {
    this._needsRedraw = this._needsRedraw || reason;
  }

  // Layers will be updated deeply (in next animation frame)
  // Potentially regenerating attributes and sub layers
  setNeedsUpdate(reason) {
    this._needsUpdate = this._needsUpdate || reason;
  }

  // Gets an (optionally) filtered list of layers
  getLayers({layerIds = null} = {}) {
    // Filtering by layerId compares beginning of strings, so that sublayers will be included
    // Dependes on the convention of adding suffixes to the parent's layer name
    return layerIds
      ? this.layers.filter(layer => layerIds.find(layerId => layer.id.indexOf(layerId) === 0))
      : this.layers;
  }

  // Set props needed for layer rendering and picking.
  setProps(props) {
    if ('debug' in props) {
      this._debug = props.debug;
    }

    // A way for apps to add data to context that can be accessed in layers
    if ('userData' in props) {
      this.context.userData = props.userData;
    }

    // TODO - For now we set layers before viewports to preserve changeFlags
    if ('layers' in props) {
      this.setLayers(props.layers);
    }
  }

  // Supply a new layer list, initiating sublayer generation and layer matching
  setLayers(newLayers, forceUpdate = false) {
    // TODO - something is generating state updates that cause rerender of the same
    const shouldUpdate = forceUpdate || newLayers !== this.lastRenderedLayers;
    debugLog(EVENT_SET_LAYERS, this, shouldUpdate, newLayers);

    if (!shouldUpdate) {
      return this;
    }
    this.lastRenderedLayers = newLayers;

    newLayers = flatten(newLayers, {filter: Boolean});

    for (const layer of newLayers) {
      layer.context = this.context;
    }

    const {error, generatedLayers} = this._updateLayers({
      oldLayers: this.layers,
      newLayers
    });

    this.layers = generatedLayers;

    // Throw first error found, if any
    if (error) {
      throw error;
    }
    return this;
  }

  // Update layers from last cycle if `setNeedsUpdate()` has been called
  updateLayers() {
    // NOTE: For now, even if only some layer has changed, we update all layers
    // to ensure that layer id maps etc remain consistent even if different
    // sublayers are rendered
    const reason = this.needsUpdate();
    if (reason) {
      this.setNeedsRedraw(`updating layers: ${reason}`);
      // Force a full update
      const forceUpdate = true;
      this.setLayers(this.lastRenderedLayers, forceUpdate);
    }
  }

  //
  // PRIVATE METHODS
  //

  _checkIfNeedsRedraw(opts) {
    let redraw = this._needsRedraw;
    if (opts.clearRedrawFlags) {
      this._needsRedraw = false;
    }

    // This layers list doesn't include sublayers, relying on composite layers
    for (const layer of this.layers) {
      // Call every layer to clear their flags
      const layerNeedsRedraw = layer.getNeedsRedraw(opts);
      redraw = redraw || layerNeedsRedraw;
    }

    return redraw;
  }

  // Make a viewport "current" in layer context, updating viewportChanged flags
  activateViewport(viewport) {
    const oldViewport = this.context.viewport;
    const viewportChanged = !oldViewport || !viewport.equals(oldViewport);

    if (viewportChanged) {
      debugLog(EVENT_ACTIVATE_VIEWPORT, this, viewport);

      this.context.viewport = viewport;

      // Update layers states
      // Let screen space layers update their state based on viewport
      for (const layer of this.layers) {
        layer.setChangeFlags({viewportChanged: 'Viewport changed'});
        this._updateLayer(layer);
      }
    }

    assert(this.context.viewport, 'LayerManager: viewport not set');

    return this;
  }

  // Match all layers, checking for caught errors
  // To avoid having an exception in one layer disrupt other layers
  // TODO - mark layers with exceptions as bad and remove from rendering cycle?
  _updateLayers({oldLayers, newLayers}) {
    // Create old layer map
    const oldLayerMap = {};
    for (const oldLayer of oldLayers) {
      if (oldLayerMap[oldLayer.id]) {
        log.warn(`Multiple old layers with same id ${layerName(oldLayer)}`)();
      } else {
        oldLayerMap[oldLayer.id] = oldLayer;
      }
    }

    // Allocate array for generated layers
    const generatedLayers = [];

    // Match sublayers
    const error = this._updateSublayersRecursively({
      newLayers,
      oldLayerMap,
      generatedLayers
    });

    // Finalize unmatched layers
    const error2 = this._finalizeOldLayers(oldLayerMap);

    this._needsUpdate = generatedLayers.some(layer => layer.hasUniformTransition());

    const firstError = error || error2;
    return {error: firstError, generatedLayers};
  }

  /* eslint-disable complexity,max-statements */
  // Note: adds generated layers to `generatedLayers` array parameter
  _updateSublayersRecursively({newLayers, oldLayerMap, generatedLayers}) {
    let error = null;

    for (const newLayer of newLayers) {
      newLayer.context = this.context;

      // Given a new coming layer, find its matching old layer (if any)
      const oldLayer = oldLayerMap[newLayer.id];
      if (oldLayer === null) {
        // null, rather than undefined, means this id was originally there
        log.warn(`Multiple new layers with same id ${layerName(newLayer)}`)();
      }
      // Remove the old layer from candidates, as it has been matched with this layer
      oldLayerMap[newLayer.id] = null;

      let sublayers = null;

      // We must not generate exceptions until after layer matching is complete
      try {
        if (this._debug && oldLayer !== newLayer) {
          newLayer.validateProps();
        }

        if (!oldLayer) {
          const err = this._initializeLayer(newLayer);
          error = error || err;
        } else {
          this._transferLayerState(oldLayer, newLayer);
          const err = this._updateLayer(newLayer);
          error = error || err;
        }
        generatedLayers.push(newLayer);

        // Call layer lifecycle method: render sublayers
        sublayers = newLayer.isComposite && newLayer.getSubLayers();
        // End layer lifecycle method: render sublayers
      } catch (err) {
        log.warn(`error during matching of ${layerName(newLayer)}`, err)();
        error = error || err; // Record first exception
      }

      if (sublayers) {
        const err = this._updateSublayersRecursively({
          newLayers: sublayers,
          oldLayerMap,
          generatedLayers
        });
        error = error || err;
      }
    }

    return error;
  }
  /* eslint-enable complexity,max-statements */

  // Finalize any old layers that were not matched
  _finalizeOldLayers(oldLayerMap) {
    let error = null;
    for (const layerId in oldLayerMap) {
      const layer = oldLayerMap[layerId];
      if (layer) {
        error = error || this._finalizeLayer(layer);
      }
    }
    return error;
  }

  // EXCEPTION SAFE LAYER ACCESS

  // Initializes a single layer, calling layer methods
  _initializeLayer(layer) {
    let error = null;
    try {
      layer._initialize();
      layer.lifecycle = LIFECYCLE.INITIALIZED;
    } catch (err) {
      log.warn(`error while initializing ${layerName(layer)}\n`, err)();
      error = error || err;
      // TODO - what should the lifecycle state be here? LIFECYCLE.INITIALIZATION_FAILED?
    }

    return error;
  }

  _transferLayerState(oldLayer, newLayer) {
    newLayer._transferState(oldLayer);
    newLayer.lifecycle = LIFECYCLE.MATCHED;

    if (newLayer !== oldLayer) {
      oldLayer.lifecycle = LIFECYCLE.AWAITING_GC;
    }
  }

  // Updates a single layer, cleaning all flags
  _updateLayer(layer) {
    let error = null;
    try {
      layer._update();
    } catch (err) {
      log.warn(`error during update of ${layerName(layer)}`, err)();
      // Save first error
      error = err;
    }
    return error;
  }

  // Finalizes a single layer
  _finalizeLayer(layer) {
    assert(layer.lifecycle !== LIFECYCLE.AWAITING_FINALIZATION);
    layer.lifecycle = LIFECYCLE.AWAITING_FINALIZATION;
    let error = null;
    this.setNeedsRedraw(`finalized ${layerName(layer)}`);
    try {
      layer._finalize();
    } catch (err) {
      log.warn(`error during finalization of ${layerName(layer)}`, err)();
      error = err;
    }
    layer.lifecycle = LIFECYCLE.FINALIZED;
    return error;
  }
}
