/* global google, document */
import {Deck} from '@deck.gl/core';
import {MapView} from '@deck.gl/core';
import {Matrix4} from 'math.gl';

// https://en.wikipedia.org/wiki/Web_Mercator_projection#Formulas
const MAX_LATITUDE = 85.05113;

/**
 * Get a new deck instance
 * @param map (google.maps.Map) - The parent Map instance
 * @param overlay (google.maps.OverlayView) - A maps Overlay instance
 * @param [deck] (Deck) - a previously created instances
 */
export function createDeckInstance(map, overlay, deck, props) {
  if (deck) {
    if (deck.props.userData._googleMap === map) {
      return deck;
    }
    // deck instance was created for a different map
    destroyDeckInstance(deck);
  }

  const eventListeners = {
    click: null,
    dblclick: null,
    mousemove: null,
    mouseout: null
  };

  deck = new Deck({
    ...props,
    style: null,
    parent: overlay && getContainer(overlay, props.style),
    initialViewState: {
      longitude: 0,
      latitude: 0,
      zoom: 1
    },
    controller: false,
    userData: {
      _googleMap: map,
      _eventListeners: eventListeners
    }
  });

  // Register event listeners
  for (const eventType in eventListeners) {
    eventListeners[eventType] = map.addListener(eventType, evt =>
      handleMouseEvent(deck, eventType, evt)
    );
  }

  return deck;
}

// Create a container that will host the deck canvas and tooltip
function getContainer(overlay, style) {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  Object.assign(container.style, style);
  if (overlay.getPanes) {
    overlay.getPanes().overlayLayer.appendChild(container);
  } else {
    overlay
      .getMap()
      .getDiv()
      .appendChild(container);
  }
  return container;
}

/**
 * Safely remove a deck instance
 * @param deck (Deck) - a previously created instances
 */
export function destroyDeckInstance(deck) {
  const {_eventListeners: eventListeners} = deck.props.userData;

  // Unregister event listeners
  for (const eventType in eventListeners) {
    eventListeners[eventType].remove();
  }

  deck.finalize();
}

/* eslint-disable max-statements */
/**
 * Get the current view state
 * @param map (google.maps.Map) - The parent Map instance
 * @param overlay (google.maps.OverlayView) - A maps Overlay instance
 */
export function getViewPropsFromOverlay(map, overlay) {
  const {width, height} = getMapSize(map);

  // Canvas position relative to draggable map's container depends on
  // overlayView's projection, not the map's. Have to use the center of the
  // map for this, not the top left, for the same reason as above.
  const projection = overlay.getProjection();

  const bounds = map.getBounds();
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const topRight = projection.fromLatLngToDivPixel(ne);
  const bottomLeft = projection.fromLatLngToDivPixel(sw);

  // google maps places overlays in a container anchored at the map center.
  // the container CSS is manipulated during dragging.
  // We need to update left/top of the deck canvas to match the base map.
  const nwContainerPx = new google.maps.Point(0, 0);
  const nw = projection.fromContainerPixelToLatLng(nwContainerPx);
  const nwDivPx = projection.fromLatLngToDivPixel(nw);
  let leftOffset = nwDivPx.x;
  let topOffset = nwDivPx.y;

  // Adjust horizontal offset - position the viewport at the map in the center
  const mapWidth = projection.getWorldWidth();
  const mapCount = Math.ceil(width / mapWidth);
  leftOffset -= Math.floor(mapCount / 2) * mapWidth;

  // Compute fractional zoom.
  const scale = height ? (bottomLeft.y - topRight.y) / height : 1;
  // When resizing aggressively, occasionally ne and sw are the same points
  // See https://github.com/visgl/deck.gl/issues/4218
  const zoom = Math.log2(scale || 1) + map.getZoom() - 1;

  // Compute fractional center.
  let centerPx = new google.maps.Point(width / 2, height / 2);
  const centerContainer = projection.fromContainerPixelToLatLng(centerPx);
  let latitude = centerContainer.lat();
  const longitude = centerContainer.lng();

  // Adjust vertical offset - limit latitude
  if (Math.abs(latitude) > MAX_LATITUDE) {
    latitude = latitude > 0 ? MAX_LATITUDE : -MAX_LATITUDE;
    const center = new google.maps.LatLng(latitude, longitude);
    centerPx = projection.fromLatLngToContainerPixel(center);
    topOffset += centerPx.y - height / 2;
  }

  return {
    width,
    height,
    left: leftOffset,
    top: topOffset,
    zoom,
    pitch: map.getTilt(),
    latitude,
    longitude
  };
}

/* eslint-enable max-statements */

/**
 * Get the current view state
 * @param map (google.maps.Map) - The parent Map instance
 * @param coordinateTransformer (google.maps.CoordinateTransformer) - A CoordinateTransformer instance
 */
export function getViewPropsFromCoordinateTransformer(map, coordinateTransformer) {
  const {width, height} = getMapSize(map);
  const {
    lat: latitude,
    lng: longitude,
    heading: bearing,
    tilt: pitch,
    zoom
  } = coordinateTransformer.getCameraParams();

  // Match Google projection matrix
  const fovy = 25;
  const aspect = width / height;

  // Match depth range (crucial for correct z-sorting)
  const near = 0.75;
  const far = 300000000000000;
  // const far = Infinity;

  const projectionMatrix = new Matrix4().perspective({
    fovy: (fovy * Math.PI) / 180,
    aspect,
    near,
    far
  });
  const focalDistance = 0.5 * projectionMatrix[5];

  return {
    width,
    height,
    views: [
      new MapView({
        id: 'google-maps-overlay-view',
        projectionMatrix
      })
    ],
    viewState: {
      altitude: focalDistance,
      bearing,
      latitude,
      longitude,
      pitch,
      repeat: true,
      zoom: zoom - 1
    }
  };
}

function getMapSize(map) {
  // The map fills the container div unless it's in fullscreen mode
  // at which point the first child of the container is promoted
  const container = map.getDiv().firstChild;
  return {
    width: container.offsetWidth,
    height: container.offsetHeight
  };
}

function getEventPixel(event, deck) {
  if (event.pixel) {
    return event.pixel;
  }
  // event.pixel may not exist when clicking on a POI
  // https://developers.google.com/maps/documentation/javascript/reference/map#MouseEvent
  const point = deck.getViewports()[0].project([event.latLng.lng(), event.latLng.lat()]);
  return {
    x: point[0],
    y: point[1]
  };
}

// Triggers picking on a mouse event
function handleMouseEvent(deck, type, event) {
  const mockEvent = {
    type,
    offsetCenter: getEventPixel(event, deck),
    srcEvent: event
  };

  switch (type) {
    case 'click':
      // Hack: because we do not listen to pointer down, perform picking now
      deck._lastPointerDownInfo = deck.pickObject(mockEvent.offsetCenter);
      mockEvent.tapCount = 1;
      deck._onEvent(mockEvent);
      break;

    case 'dblclick':
      mockEvent.type = 'click';
      mockEvent.tapCount = 2;
      deck._onEvent(mockEvent);
      break;

    case 'mousemove':
      mockEvent.type = 'pointermove';
      deck._onPointerMove(mockEvent);
      break;

    case 'mouseout':
      mockEvent.type = 'pointerleave';
      deck._onPointerMove(mockEvent);
      break;

    default:
      return;
  }
}
