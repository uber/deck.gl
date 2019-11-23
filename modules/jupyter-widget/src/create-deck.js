import {DeckGLModel, DeckGLView} from './widget';
import makeTooltip from './widget-tooltip';

import {__ssr_safe__mapboxgl as mapboxgl} from './ssr-safe-mapbox';

import {CSVLoader} from '@loaders.gl/csv';
import {Tile3DLoader} from '@loaders.gl/3d-tiles';
import {LASWorkerLoader} from '@loaders.gl/las';
import * as loaders from '@loaders.gl/core';

import * as deck from './deck-bundle';

import GL from '@luma.gl/constants';

function extractClasses() {
  // Get classes for registration from standalone deck.gl
  const classesDict = {};
  const classes = Object.keys(deck).filter(
    x => (x.indexOf('Layer') > 0 || x.indexOf('View') > 0) && x.indexOf('_') !== 0
  );
  classes.map(k => (classesDict[k] = deck[k]));
  return deck;
}

function createDeckWithImports(args) {
  // Handle JSONConverter and loaders configuration
  const jsonConverterConfiguration = {
    classes: extractClasses(),
    // Will be resolved as `<enum-name>.<enum-value>`
    enumerations: {
      COORDINATE_SYSTEM: deck.COORDINATE_SYSTEM,
      GL
    },

    // Constants that should be resolved with the provided values by JSON converter
    constants: {
      Tile3DLoader,
      LASWorkerLoader
    }
  };

  loaders.registerLoaders([CSVLoader, Tile3DLoader, LASWorkerLoader]);
  createDeck({jsonConverterConfiguration, ...args});
}

function createDeck({
  jsonConverterConfiguration,
  mapboxApiKey,
  container,
  jsonInput,
  tooltip,
  onComplete,
  handleClick,
  handleWarning
}) {
  try {
    const jsonConverter = new deck.JSONConverter({
      configuration: jsonConverterConfiguration
    });

    const props = jsonConverter.convert(jsonInput);

    const getTooltip = makeTooltip(tooltip);

    const deckgl = new deck.DeckGL({
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

    if (onComplete) {
      onComplete({jsonConverter, deckgl});
    }
  } catch (err) {
    // This will fail in node tests
    // eslint-disable-next-line
    console.error(err);
  }
  return {};
}

function injectFunction(warnFunction, messageHandler) {
  return (...args) => {
    messageHandler(...args);
    return warnFunction(...args);
  };
}

DeckGLView.deckInitFunction = createDeckWithImports;
export {DeckGLView, DeckGLModel, createDeckWithImports};
