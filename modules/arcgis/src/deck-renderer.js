/* eslint-disable no-invalid-this */

import {initializeResources, render, finalizeResources} from './commons';

// ArcGIS fov is corner-to-corner
function arcgisFOVToDeckAltitude(fov, aspectRatio) {
  const D = Math.sqrt(1 + aspectRatio ** 2);
  const halfFOV = (fov / 2 / 180) * Math.PI;
  return D / 2 / Math.tan(halfFOV);
}

export default function createDeckRenderer(DeckProps, externalRenderers) {
  class DeckRenderer {
    constructor(view, props) {
      this.view = view;
      this.deck = new DeckProps(props);
    }

    setup(context) {
      const gl = context.gl;
      initializeResources.call(this, gl);

      this.deck.on('change', props => this.deckInstance.setProps(props));

      this.deckInstance.setProps(this.deck.toJSON());
    }

    dispose() {
      finalizeResources.call(this);
    }

    redraw() {
      externalRenderers.requestRender(this.view);
    }

    render(context) {
      const [width, height] = this.view.size;

      let viewState;
      if (this.view.viewingMode === 'global') {
        viewState = {
          latitude: this.view.camera.position.latitude,
          longitude: this.view.camera.position.longitude,
          altitude: this.view.camera.position.z / 7000000, // TODO
          zoom: Math.log2(45000000 / this.view.camera.position.z), // TODO
          bearing: this.view.camera.heading,
          pitch: this.view.camera.tilt
        };
        console.log(viewState); // eslint-disable-line
      } else if (this.view.viewingMode === 'local') {
        viewState = {
          latitude: this.view.center.latitude,
          longitude: this.view.center.longitude,
          altitude: arcgisFOVToDeckAltitude(this.view.camera.fov, width / height),
          zoom: this.view.zoom,
          bearing: this.view.camera.heading,
          pitch: this.view.camera.tilt
        };
      } else {
        throw new Error('Invalid state');
      }

      render.call(this, {
        gl: context.gl,
        width,
        height,
        viewState
      });
    }
  }

  return DeckRenderer;
}
