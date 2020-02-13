import makeTooltip from './widget-tooltip';

import mapboxgl from './ssr-safe-mapbox';

import {CSVLoader} from '@loaders.gl/csv';
import {Tile3DLoader} from '@loaders.gl/3d-tiles';
import {registerLoaders} from '@loaders.gl/core';

import * as deck from './deck-bundle';

import GL from '@luma.gl/constants';

function extractClasses(library) {
  // Extracts exported class constructors as a dictionary from a library
  const classesDict = {};
  const classes = Object.keys(library).filter(x => x.charAt(0) === x.charAt(0).toUpperCase());
  for (const cls of classes) {
    classesDict[cls] = library[cls];
  }
  return classesDict;
}

// Handle JSONConverter and loaders configuration
const jsonConverterConfiguration = {
  classes: extractClasses(deck),
  // Will be resolved as `<enum-name>.<enum-value>`
  enumerations: {
    COORDINATE_SYSTEM: deck.COORDINATE_SYSTEM,
    GL
  },

  // Constants that should be resolved with the provided values by JSON converter
  constants: {
    Tile3DLoader
  }
};

registerLoaders([CSVLoader, Tile3DLoader]);

const jsonConverter = new deck.JSONConverter({
  configuration: jsonConverterConfiguration
});

function alreadyLoaded(url) {
  // Save time by not reloading the same URL
  for (const scriptTag of document.querySelectorAll('script')) {
    if (scriptTag.src === url) {
      return true;
    }
  }
  return false;
}

/* global document, window */
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

function loadExternalLibrary({libraryName, resourceUri, onComplete}, loadResource = loadScript) {
  // NOTE loadResource is for testing only
  loadResource(resourceUri).then(res => {
    const module = window[libraryName];
    const newConfiguration = {
      classes: extractClasses(module)
    };
    jsonConverter.mergeConfiguration(newConfiguration);
    if (onComplete) onComplete();
  });
}

function addCustomLibraries(customLibraries) {
  if (!customLibraries) {
    return;
  }
  for (const obj of customLibraries) {
    // obj is an object of {libraryName: <string>, url: <string>}
    const [libraryName, resourceUri] = Object.entries(obj)[0];
    if (!alreadyLoaded(resourceUri)) {
      loadExternalLibrary({libraryName, resourceUri});
    }
  }
}

function updateDeck({inputJson, deckgl, customLibraries}) {
  const results = jsonConverter.convert(inputJson);
  addCustomLibraries(customLibraries);
  deckgl.setProps(results);
}

function createDeck({
  mapboxApiKey,
  container,
  jsonInput,
  tooltip,
  handleClick,
  handleWarning,
  customLibraries
}) {
  let deckgl;
  try {
    const props = jsonConverter.convert(jsonInput);

    addCustomLibraries(customLibraries);
    const getTooltip = makeTooltip(tooltip);

    deckgl = new deck.DeckGL({
      ...props,
      map: mapboxgl,
      mapboxApiAccessToken: mapboxApiKey,
      onClick: handleClick,
      getTooltip,
      container
    });

    // TODO overrride console.warn instead
    // Right now this isn't doable (in a Notebook at least)
    // because the widget loads in deck.gl (and its logger) before @deck.gl/jupyter-widget
    if (handleWarning) {
      const warn = deck.log.warn;
      deck.log.warn = injectFunction(warn, handleWarning);
    }
  } catch (err) {
    // This will fail in node tests
    // eslint-disable-next-line
    console.error(err);
  }
  return deckgl;
}

function injectFunction(warnFunction, messageHandler) {
  return (...args) => {
    messageHandler(...args);
    return warnFunction(...args);
  };
}

export {jsonConverter, createDeck, updateDeck, loadExternalLibrary};
