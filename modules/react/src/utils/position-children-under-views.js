import {createElement} from 'react';
import {View} from '@deck.gl/core';
import {inheritsFrom} from './inherits-from';
import evaluateChildren from './evaluate-children';

// Iterate over views and reposition children associated with views
// TODO - Can we supply a similar function for the non-React case?
export default function positionChildrenUnderViews({children, viewports, deck, ContextProvider}) {
  const {viewManager} = deck || {};

  if (!viewManager || !viewManager.views.length) {
    return [];
  }

  const views = {};
  const defaultViewId = viewManager.views[0].id;

  // Sort children by view id
  for (const child of children) {
    // Unless child is a View, position / render as part of the default view
    let viewId = defaultViewId;
    let viewChildren = child;

    if (inheritsFrom(child.type, View)) {
      viewId = child.props.id || defaultViewId;
      viewChildren = child.props.children;
    }

    const viewport = viewManager.getViewport(viewId);
    const viewState = viewManager.getViewState(viewId);

    // Drop (auto-hide) elements with viewId that are not matched by any current view
    if (viewport) {
      const {x, y, width, height} = viewport;
      // Resolve potentially relative dimensions using the deck.gl container size
      viewChildren = evaluateChildren(viewChildren, {
        x,
        y,
        width,
        height,
        viewport,
        viewState
      });

      if (!views[viewId]) {
        views[viewId] = {
          viewport,
          children: []
        };
      }
      views[viewId].children.push(viewChildren);
    }
  }

  // Render views
  return Object.keys(views).map(viewId => {
    const {viewport: {x, y, width, height}} = views[viewId];
    let viewChildren = views[viewId].children;
    const style = {
      position: 'absolute',
      left: x,
      top: y,
      width,
      height
    };

    const key = `view-${viewId}`;

    if (ContextProvider) {
      const contextValue = {
        viewport,
        container: deck.canvas.offsetParent,
        eventManager: deck.eventManager,
        onViewStateChange: params => {
          params.viewId = viewId;
          deck._onViewStateChange(params);
        }
      };
      viewChildren = createElement(ContextProvider, {value: contextValue}, viewChildren);
    }

    return createElement('div', {key, id: key, style}, viewChildren);
  });
}
