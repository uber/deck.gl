import React, {useState, useEffect} from 'react';
import {render} from 'react-dom';

import DeckGL, {OrthographicView, COORDINATE_SYSTEM} from 'deck.gl';
import {TileLayer} from '@deck.gl/geo-layers';
import {BitmapLayer} from '@deck.gl/layers';
import {load} from '@loaders.gl/core';
import {clamp} from 'math.gl';

const INITIAL_VIEW_STATE = {
  target: [13000, 13000, 0],
  zoom: -7
};

const ROOT_URL =
  'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/image-tiles/moon.image';

function getTooltip({tile}) {
  return tile
    ? {
        className: 'tooltip',
        text: `tile: x: ${tile.x}, y: ${tile.y}, z: ${tile.z}`
      }
    : null;
}

export default function App({autoHighlight = true}) {
  const [dimensions, setDimensions] = useState(null);

  useEffect(() => {
    const dziSource = `${ROOT_URL}/moon.image.dzi`;
    fetch(dziSource) // eslint-disable-line no-undef
      .then(response => response.text())
      // eslint-disable-next-line no-undef
      .then(str => new window.DOMParser().parseFromString(str, 'text/xml'))
      .then(dziXML => {
        if (Number(dziXML.getElementsByTagName('Image')[0].attributes.Overlap.value) !== 0) {
          // eslint-disable-next-line no-undef, no-console
          console.warn('Overlap paramter is nonzero and should be 0');
        }
        setDimensions({
          height: Number(dziXML.getElementsByTagName('Size')[0].attributes.Height.value),
          width: Number(dziXML.getElementsByTagName('Size')[0].attributes.Width.value),
          tileSize: Number(dziXML.getElementsByTagName('Image')[0].attributes.TileSize.value)
        });
      });
  }, []);

  const tileLayer =
    dimensions &&
    new TileLayer({
      pickable: true,
      tileSize: dimensions.tileSize,
      autoHighlight,
      highlightColor: [60, 60, 60, 40],
      minZoom: -7,
      maxZoom: 0,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      extent: [0, 0, dimensions.width, dimensions.height],
      getTileData: ({x, y, z}) => {
        return load(`${ROOT_URL}/moon.image_files/${15 + z}/${x}_${y}.jpeg`);
      },

      renderSubLayers: props => {
        const {
          bbox: {left, bottom, right, top}
        } = props.tile;
        const {width, height} = dimensions;
        return new BitmapLayer(props, {
          data: null,
          image: props.data,
          bounds: [
            clamp(left, 0, width),
            clamp(bottom, 0, height),
            clamp(right, 0, width),
            clamp(top, 0, height)
          ]
        });
      }
    });

  return (
    <DeckGL
      views={[new OrthographicView({id: 'ortho'})]}
      layers={[tileLayer]}
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
      getTooltip={getTooltip}
    />
  );
}

export function renderToDOM(container) {
  render(<App />, container);
}
