/* global console, window */
/* eslint-disable no-console */
import {CSVLoader} from '@loaders.gl/csv';
import {registerLoaders} from '@loaders.gl/core';
// Avoid calling it GL - would be removed by babel-plugin-inline-webgl-constants
import GLConstants from '@luma.gl/constants';

import makeTooltip from './widget-tooltip';

import mapboxgl, {modifyMapboxElements} from './utils/mapbox-utils';
import {loadScript} from './utils/script-utils';
import {createGoogleMapsDeckOverlay} from './utils/google-maps-utils';

import {addSupportComponents} from '../lib/components/index';

import * as deck from '../deck-bundle';

function extractClasses(library = {}) {
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
    GL: GLConstants
  }
};

registerLoaders([CSVLoader]);

const jsonConverter = new deck.JSONConverter({
  configuration: jsonConverterConfiguration
});

function addModuleToConverter(module, converter) {
  const newConfiguration = {
    classes: extractClasses(module)
  };
  converter.mergeConfiguration(newConfiguration);
}

export function addCustomLibraries(customLibraries, onComplete) {
  if (!customLibraries) {
    return;
  }

  const loaded = {};

  function onEachFinish() {
    if (Object.values(loaded).every(f => f)) {
      // when all libraries loaded
      if (typeof onComplete === 'function') onComplete();
    }
  }

  function onModuleLoaded(libraryName, module) {
    addModuleToConverter(module, jsonConverter);
    loaded[libraryName] = module;
    onEachFinish();
  }

  customLibraries.forEach(({libraryName, resourceUri}) => {
    // set loaded to be false, even if addCustomLibraries is called multiple times
    // with the same parameters
    loaded[libraryName] = false;

    if (libraryName in window) {
      // do not redefine
      onModuleLoaded(libraryName, window[libraryName]);
      return;
    }

    // because loadscript is async and scipt execution is untraceble
    // the only way we can listen on its execution complete is to observe on the
    // window.libraryName property
    Object.defineProperty(window, libraryName, {
      set: module => onModuleLoaded(libraryName, module),
      get: () => {
        return loaded[libraryName];
      }
    });

    loadScript(resourceUri);
  });
}

function updateDeck(inputJson, deckgl) {
  const results = jsonConverter.convert(inputJson);
  deckgl.setProps(results);
}

function missingLayers(oldLayers, newLayers) {
  return oldLayers.filter(ol => ol && ol.id && !newLayers.find(nl => nl.id === ol.id));
}

function createStandaloneFromProvider({
  mapProvider,
  props,
  mapboxApiKey,
  googleMapsKey,
  handleEvent,
  getTooltip,
  container
}) {
  // Common deck.gl props for all basemaos
  const handlers = handleEvent
    ? {
        onClick: info => handleEvent('deck-click-event', info),
        onHover: info => handleEvent('deck-hover-event', info),
        onResize: size => handleEvent('deck-resize-event', size),
        onViewStateChange: ({viewState, interactionState, oldViewState}) => {
          const viewport = new deck.WebMercatorViewport(viewState);
          viewState.nw = viewport.unproject([0, 0]);
          viewState.se = viewport.unproject([viewport.width, viewport.height]);
          handleEvent('deck-view-state-change-event', viewState);
        },
        onDragStart: info => handleEvent('deck-drag-start-event', info),
        onDrag: info => handleEvent('deck-drag-event', info),
        onDragEnd: info => handleEvent('deck-drag-end-event', info)
      }
    : null;

  const sharedProps = {
    ...handlers,
    getTooltip,
    container
  };

  switch (mapProvider) {
    case 'mapbox':
      deck.log.info('Using Mapbox base maps')();
      return new deck.DeckGL({
        ...sharedProps,
        ...props,
        map: mapboxgl,
        mapboxApiAccessToken: mapboxApiKey,
        onLoad: modifyMapboxElements
      });
    case 'carto':
      deck.log.info('Using Carto base maps')();
      return new deck.DeckGL({
        map: mapboxgl,
        ...sharedProps,
        ...props
      });
    case 'google_maps':
      deck.log.info('Using Google Maps base maps')();
      return createGoogleMapsDeckOverlay({
        ...sharedProps,
        ...props,
        googleMapsKey
      });
    default:
      deck.log.info('No recognized map provider specified')();
      return new deck.DeckGL({
        ...sharedProps,
        ...props,
        map: null,
        mapboxApiAccessToken: null
      });
  }
}

function createDeck({
  mapboxApiKey,
  googleMapsKey,
  container,
  tooltip,
  handleEvent,
  customLibraries,
  deckProps
}) {
  let deckgl;
  try {
    const oldLayers = deckProps.layers || [];
    const props = jsonConverter.convert(deckProps);

    addSupportComponents(container, props);

    const convertedLayers = (props.layers || []).filter(l => l);

    // loading custom library is async, some layers might not be convertable before custom library loads
    const layerToLoad = missingLayers(oldLayers, convertedLayers);
    const getTooltip = makeTooltip(tooltip);
    const {mapProvider} = props;

    deckgl = createStandaloneFromProvider({
      mapProvider,
      mapboxApiKey,
      googleMapsKey,
      handleEvent,
      getTooltip,
      container,
      props
    });

    const onComplete = () => {
      if (layerToLoad.length) {
        // convert input layer again to presist layer order
        const newProps = jsonConverter.convert({layers: deckProps.layers});
        const newLayers = (newProps.layers || []).filter(l => l);

        if (newLayers.length > convertedLayers.length) {
          // if more layers are converted
          deckgl.setProps({layers: newLayers});
        }
      }
    };

    addCustomLibraries(customLibraries, onComplete);
  } catch (err) {
    // This will fail in node tests
    // eslint-disable-next-line
    console.error(err);
  }
  return deckgl;
}

export {createDeck, updateDeck, jsonConverter};
