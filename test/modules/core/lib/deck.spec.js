import test from 'tape-catch';
import {ScatterplotLayer} from '@deck.gl/layers';
import {gl} from '@deck.gl/test-utils';

test('Deck#constructor', t => {
  const callbacks = {
    onWebGLInitialized: 0,
    onBeforeRender: 0,
    onResize: 0,
    onLoad: 0
  };

  const deck = new Deck({
    gl,
    width: 1,
    height: 1,
    // This is required because the jsdom canvas does not have client width/height
    autoResizeDrawingBuffer: gl.canvas.clientWidth > 0,

    viewState: {
      longitude: 0,
      latitude: 0,
      zoom: 0
    },

    layers: [],

    onWebGLInitialized: () => callbacks.onWebGLInitialized++,
    onBeforeRender: () => callbacks.onBeforeRender++,
    onResize: () => callbacks.onResize++,

    onAfterRender: () => {
      t.is(callbacks.onWebGLInitialized, 1, 'onWebGLInitialized called');
      t.is(callbacks.onLoad, 1, 'onLoad called');
      t.is(callbacks.onResize, 1, 'onResize called');
      t.is(callbacks.onBeforeRender, 1, 'first draw');

      deck.finalize();
      t.notOk(deck.layerManager, 'layerManager is finalized');
      t.notOk(deck.viewManager, 'viewManager is finalized');
      t.notOk(deck.deckRenderer, 'deckRenderer is finalized');
      t.end();
    },

    onLoad: () => {
      callbacks.onLoad++;

      t.ok(deck.layerManager, 'layerManager initialized');
      t.ok(deck.viewManager, 'viewManager initialized');
      t.ok(deck.deckRenderer, 'deckRenderer initialized');
    }
  });

  t.pass('Deck constructor did not throw');
});

test('Deck#picking', t => {
  const deck = new Deck({
    gl,
    width: 1,
    height: 1,
    // This is required because the jsdom canvas does not have client width/height
    autoResizeDrawingBuffer: gl.canvas.clientWidth > 0,

    viewState: {
      longitude: 0,
      latitude: 0,
      zoom: 12
    },

    layers: [
      new ScatterplotLayer({
        data: [{position: [0, 0]}, {position: [0, 0]}],
        radiusMinPixels: 100,
        pickable: true
      })
    ],

    onLoad: () => {
      const info = deck.pickObject({x: 0, y: 0});
      t.is(info && info.index, 1, 'Picked object');

      let infos = deck.pickMultipleObjects({x: 0, y: 0});
      t.is(infos.length, 2, 'Picked multiple objects');

      infos = deck.pickObjects({x: 0, y: 0, width: 1, height: 1});
      t.is(infos.length, 1, 'Picked objects');

      deck.finalize();
      t.end();
    }
  });
});
