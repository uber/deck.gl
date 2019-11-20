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

/* eslint-disable guard-for-in */
import Attribute from './attribute';
import log from '../../utils/log';

import AttributeTransitionManager from './attribute-transition-manager';

const LOG_START_END_PRIORITY = 2;
const LOG_DETAIL_PRIORITY = 3;

function noop() {}

// Default loggers
const logFunctions = {
  savedMessages: null,
  timeStart: null,
  onLog: ({level, message}) => {
    log.log(level, message)();
  },
  onUpdateStart: ({level, numInstances}) => {
    logFunctions.savedMessages = [];
    logFunctions.timeStart = new Date();
  },
  onUpdate: ({level, message}) => {
    if (logFunctions.savedMessages) {
      logFunctions.savedMessages.push(message);
    }
  },
  onUpdateEnd: ({level, id, numInstances}) => {
    const timeMs = Math.round(new Date() - logFunctions.timeStart);
    const time = `${timeMs}ms`;
    log.group(level, `Updated attributes for ${numInstances} instances in ${id} in ${time}`, {
      collapsed: true
    })();
    for (const message of logFunctions.savedMessages) {
      log.log(level, message)();
    }
    log.groupEnd(level, `Updated attributes for ${numInstances} instances in ${id} in ${time}`)();
    logFunctions.savedMessages = null;
  }
};

export default class AttributeManager {
  /**
   * Sets log functions to help trace or time attribute updates.
   * Default logging uses deck logger.
   *
   * `onLog` is called for each attribute.
   *
   * To enable detailed control of timming and e.g. hierarchical logging,
   * hooks are also provided for update start and end.
   *
   * @param {Object} [opts]
   * @param {String} [onLog=] - called to print
   * @param {String} [onUpdateStart=] - called before update() starts
   * @param {String} [onUpdateEnd=] - called after update() ends
   */
  static setDefaultLogFunctions({onLog, onUpdateStart, onUpdate, onUpdateEnd} = {}) {
    if (onLog !== undefined) {
      logFunctions.onLog = onLog || noop;
    }
    if (onUpdateStart !== undefined) {
      logFunctions.onUpdateStart = onUpdateStart || noop;
    }
    if (onUpdate !== undefined) {
      logFunctions.onUpdate = onUpdate || noop;
    }
    if (onUpdateEnd !== undefined) {
      logFunctions.onUpdateEnd = onUpdateEnd || noop;
    }
  }

  /**
   * @classdesc
   * Automated attribute generation and management. Suitable when a set of
   * vertex shader attributes are generated by iteration over a data array,
   * and updates to these attributes are needed either when the data itself
   * changes, or when other data relevant to the calculations change.
   *
   * - First the application registers descriptions of its dynamic vertex
   *   attributes using AttributeManager.add().
   * - Then, when any change that affects attributes is detected by the
   *   application, the app will call AttributeManager.invalidate().
   * - Finally before it renders, it calls AttributeManager.update() to
   *   ensure that attributes are automatically rebuilt if anything has been
   *   invalidated.
   *
   * The application provided update functions describe how attributes
   * should be updated from a data array and are expected to traverse
   * that data array (or iterable) and fill in the attribute's typed array.
   *
   * Note that the attribute manager intentionally does not do advanced
   * change detection, but instead makes it easy to build such detection
   * by offering the ability to "invalidate" each attribute separately.
   */
  constructor(gl, {id = 'attribute-manager', stats, timeline} = {}) {
    this.id = id;
    this.gl = gl;

    this.attributes = {};

    this.updateTriggers = {};
    this.accessors = {};
    this.needsRedraw = true;

    this.userData = {};
    this.stats = stats;

    this.attributeTransitionManager = new AttributeTransitionManager(gl, {
      id: `${id}-transitions`,
      timeline
    });

    // For debugging sanity, prevent uninitialized members
    Object.seal(this);
  }

  finalize() {
    for (const attributeName in this.attributes) {
      this.attributes[attributeName].delete();
    }
    this.attributeTransitionManager.finalize();
  }

  // Returns the redraw flag, optionally clearing it.
  // Redraw flag will be set if any attributes attributes changed since
  // flag was last cleared.
  //
  // @param {String} [clearRedrawFlags=false] - whether to clear the flag
  // @return {false|String} - reason a redraw is needed.
  getNeedsRedraw(opts = {clearRedrawFlags: false}) {
    const redraw = this.needsRedraw;
    this.needsRedraw = this.needsRedraw && !opts.clearRedrawFlags;
    return redraw && this.id;
  }

  // Sets the redraw flag.
  // @param {Boolean} redraw=true
  // @return {AttributeManager} - for chaining
  setNeedsRedraw(redraw = true) {
    this.needsRedraw = true;
    return this;
  }

  // Adds attributes
  add(attributes, updaters) {
    this._add(attributes, updaters);
  }

  // Adds attributes
  addInstanced(attributes, updaters) {
    this._add(attributes, updaters, {instanced: 1});
  }

  /**
   * Removes attributes
   * Takes an array of attribute names and delete them from
   * the attribute map if they exists
   *
   * @example
   * attributeManager.remove(['position']);
   *
   * @param {Object} attributeNameArray - attribute name array (see above)
   */
  remove(attributeNameArray) {
    for (let i = 0; i < attributeNameArray.length; i++) {
      const name = attributeNameArray[i];
      if (this.attributes[name] !== undefined) {
        this.attributes[name].delete();
        delete this.attributes[name];
      }
    }
  }

  // Marks an attribute for update
  invalidate(triggerName, dataRange) {
    const invalidatedAttributes = this._invalidateTrigger(triggerName, dataRange);
    // For performance tuning
    logFunctions.onLog({
      level: LOG_DETAIL_PRIORITY,
      message: `invalidated attributes ${invalidatedAttributes} (${triggerName}) for ${this.id}`
    });
  }

  invalidateAll(dataRange) {
    for (const attributeName in this.attributes) {
      this.attributes[attributeName].setNeedsUpdate(attributeName, dataRange);
    }
    // For performance tuning
    logFunctions.onLog({
      level: LOG_DETAIL_PRIORITY,
      message: `invalidated all attributes for ${this.id}`
    });
  }

  // Ensure all attribute buffers are updated from props or data.
  update({
    data,
    numInstances,
    startIndices = null,
    transitions,
    props = {},
    buffers = {},
    context = {}
  } = {}) {
    // keep track of whether some attributes are updated
    let updated = false;

    logFunctions.onUpdateStart({level: LOG_START_END_PRIORITY, id: this.id, numInstances});
    if (this.stats) {
      this.stats.get('Update Attributes').timeStart();
    }

    for (const attributeName in this.attributes) {
      const attribute = this.attributes[attributeName];
      const accessorName = attribute.settings.accessor;
      attribute.startIndices = startIndices;

      if (props[attributeName]) {
        log.removed(`props.${attributeName}`, `data.attributes.${attributeName}`)();
      }

      if (attribute.setExternalBuffer(buffers[attributeName])) {
        // Step 1: try update attribute directly from external buffers
      } else if (attribute.setLogicalValue(buffers[accessorName], data.startIndices)) {
        // Step 2: try set logical value from external buffers
      } else if (attribute.setConstantValue(props[accessorName])) {
        // Step 3: try set constant value from props
      } else if (attribute.needsUpdate()) {
        // Step 4: update via updater callback
        updated = true;
        this._updateAttribute({
          attribute,
          numInstances,
          data,
          props,
          context
        });
      }

      this.needsRedraw |= attribute.needsRedraw();
    }

    if (updated) {
      // Only initiate alloc/update (and logging) if actually needed
      logFunctions.onUpdateEnd({level: LOG_START_END_PRIORITY, id: this.id, numInstances});
    }

    if (this.stats) {
      this.stats.get('Update Attributes').timeEnd();
    }

    this.attributeTransitionManager.update({
      attributes: this.attributes,
      numInstances,
      transitions
    });
  }

  // Update attribute transition to the current timestamp
  // Returns `true` if any transition is in progress
  updateTransition() {
    const {attributeTransitionManager} = this;
    const transitionUpdated = attributeTransitionManager.run();
    this.needsRedraw = this.needsRedraw || transitionUpdated;
    return transitionUpdated;
  }

  /**
   * Returns all attribute descriptors
   * Note: Format matches luma.gl Model/Program.setAttributes()
   * @return {Object} attributes - descriptors
   */
  getAttributes() {
    return this.attributes;
  }

  /**
   * Returns changed attribute descriptors
   * This indicates which WebGLBuffers need to be updated
   * @return {Object} attributes - descriptors
   */
  getChangedAttributes(opts = {clearChangedFlags: false}) {
    const {attributes, attributeTransitionManager} = this;

    const changedAttributes = Object.assign({}, attributeTransitionManager.getAttributes());

    for (const attributeName in attributes) {
      const attribute = attributes[attributeName];
      if (attribute.needsRedraw(opts) && !attributeTransitionManager.hasAttribute(attributeName)) {
        changedAttributes[attributeName] = attribute;
      }
    }

    return changedAttributes;
  }

  // Returns shader attributes
  getShaderAttributes(attributes, excludeAttributes = {}) {
    if (!attributes) {
      attributes = this.getAttributes();
    }
    const shaderAttributes = {};
    for (const attributeName in attributes) {
      if (!excludeAttributes[attributeName]) {
        Object.assign(shaderAttributes, attributes[attributeName].getShaderAttributes());
      }
    }
    return shaderAttributes;
  }

  // PROTECTED METHODS - Only to be used by collaborating classes, not by apps

  // Returns object containing all accessors as keys, with non-null values
  // @return {Object} - accessors object
  getAccessors() {
    return this.updateTriggers;
  }

  // PRIVATE METHODS

  // Used to register an attribute
  _add(attributes, updaters, extraProps = {}) {
    if (updaters) {
      log.warn('AttributeManager.add({updaters}) - updater map no longer supported')();
    }

    const newAttributes = {};

    for (const attributeName in attributes) {
      const attribute = attributes[attributeName];

      // Initialize the attribute descriptor, with WebGL and metadata fields
      const newAttribute = this._createAttribute(attributeName, attribute, extraProps);

      newAttributes[attributeName] = newAttribute;
    }

    Object.assign(this.attributes, newAttributes);

    this._mapUpdateTriggersToAttributes();
  }
  /* eslint-enable max-statements */

  _createAttribute(name, attribute, extraProps) {
    const props = {
      id: name,
      // Luma fields
      constant: attribute.constant || false,
      isIndexed: attribute.isIndexed || attribute.elements,
      size: (attribute.elements && 1) || attribute.size,
      value: attribute.value || null,
      divisor: attribute.instanced || extraProps.instanced ? 1 : attribute.divisor
    };

    return new Attribute(this.gl, Object.assign({}, attribute, props));
  }

  // build updateTrigger name to attribute name mapping
  _mapUpdateTriggersToAttributes() {
    const triggers = {};

    for (const attributeName in this.attributes) {
      const attribute = this.attributes[attributeName];
      attribute.getUpdateTriggers().forEach(triggerName => {
        if (!triggers[triggerName]) {
          triggers[triggerName] = [];
        }
        triggers[triggerName].push(attributeName);
      });
    }

    this.updateTriggers = triggers;
  }

  _invalidateTrigger(triggerName, dataRange) {
    const {attributes, updateTriggers} = this;
    const invalidatedAttributes = updateTriggers[triggerName];

    if (invalidatedAttributes) {
      invalidatedAttributes.forEach(name => {
        const attribute = attributes[name];
        if (attribute) {
          attribute.setNeedsUpdate(attribute.id, dataRange);
        }
      });
    } else {
      let message = `invalidating non-existent trigger ${triggerName} for ${this.id}\n`;
      message += `Valid triggers: ${Object.keys(attributes).join(', ')}`;
      log.warn(message, invalidatedAttributes)();
    }
    return invalidatedAttributes;
  }

  _updateAttribute(opts) {
    const {attribute, numInstances} = opts;

    if (attribute.allocate(numInstances)) {
      logFunctions.onUpdate({
        level: LOG_DETAIL_PRIORITY,
        message: `${attribute.id} allocated ${numInstances}`,
        id: this.id
      });
    }

    // Calls update on any buffers that need update
    const timeStart = Date.now();

    const updated = attribute.updateBuffer(opts);
    if (updated) {
      this.needsRedraw = true;

      const timeMs = Math.round(Date.now() - timeStart);
      logFunctions.onUpdate({
        level: LOG_DETAIL_PRIORITY,
        message: `${attribute.id} updated ${numInstances} in ${timeMs}ms`
      });
    }
  }
}
