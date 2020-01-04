# RFC: Data Loading Enhancements (Improve deck.gl / loaders.gl integration)

* **Author**: Ib Green
* **Date**: May 2019
* **Status**: **Draft**

## Abstract

This RFC suggests a number of improvements to loading support in deck.gl, in particular to support seamless optional integration with loaders.gl.

## Background

The vision of loaders.gl is that loaders are designed to be directly compatible with luma.gl and deck.gl and easy/intuitive to use is not fully realized in deck.gl v7.0.

We want to maximize the out-of-the-box convenience of the deck.gl/loaders.gl integration (i.e. data just loads and parses as expected with almost zero configuration) while providing fine-grained control over loading and options. Ideally a subset of the fine-grained control can be specified declaratively such that it works in the JSON and Python integration.


## Problems

- Adding/replacing loaders
     - for all layers / the entire app
     - for all props in a specific layer
     - for a specific prop (url) in a layer
- Specifying options for a specific loader
     - for all layers / the entire app
     - for all props in a specific layer
     - for a specific prop (url) in a layer
- Specifying options for `fetch`
    - for all props (urls)
    - just a specific prop (url)

 - Ability to call loaders outside of deck.gl (i.e. not implicitly as the result of passing in a URL prop) and pass in the result to the layer as data (ScenegraphLayer issue).

- Overriding the
* No separation between loading and parsing - The application should not need reimplement parsing just to add a header to the `fetch` call.

- The main method for redefining loading.
There are some ways around this, like using fake urls and checking for them in the fetch method to

No good way to specify different loaders for different props.

### Proposal 1a: Async loading uses `load`

Doing so lets us move almost all loading override logic and option handling to loaders.gl, and keeps deck.gl loading implementation minimal and clean.

```js
const defaultProps = {
  fetch: {
    type: 'function',
    value: (url, {layer}) => load(url, layer.getLoadOptions()),
  }
};
```

### Proposal 1c: Deprecate `props.fetch`

The current v7.1 `fetch` prop semantics are not consistent with `fetch` semantic and loaders.gl conventions.

In particular `props.fetch` is expected to both fetch and parse. If proposal 1c is implemented, we can deprecate the current `fetch` prop.

If we still need this capability (e.g. because we think that defining a custom loader object is too complicated), we should probably call it `props.load` instead.


### Proposal 1d: Separate fetching from parsing (fetch returns String/ArrayBuffer or Response)

> This proposal has been moved to a separate RFC in loaders.gl.

To enable `fetch` to be redefined by application (when using async props), the proposal is to add a `fetch` option to loaders.gl `load`,

Simple examples that use loader.gl `load` option to call `fetch` with options

```js
  SomeLayer({
    data: INTERNAL_DATA_URL,
    load: {
      fetch: {headers: {'Company-Access-Token': 'Secret-Value'}}
      // or
      fetch: url => fetch(url, {headers: {'Company-Access-Token': 'Secret-Value'}})
    }
  })
```

Design Notes:
- A problem is that some loaders (mainly image loaders) do not support a separate call to fetch, but instead load and parse in a single operation. Cross origin type options must be specified in some other way. This is discussed in the loaders.gl RFC

### Proposal 2a: Specify loader options for a layer

The proposed strategy is to invest in refining option handling in loaders.gl and focus on having a simple and clean mechanisms in deck.gl to forward loader props to loaders.gl `load` call.

```js
  SomeBitmapLayer({
    data: DATA_URL,
    bitmap: BITMAP_URL,
    loadOptions: {
      fetch: {headers: {...}}
    }
  })
```

Design Issues:
- Naming of the prop: `load`, `loadOptions`, `loaderOptions`, ...?
- Do we need to be able to specify some loader options in the layer default props?
- If so, do we need to implement a deep merge of loader prop objects? Should loaders.gl support that?


### Proposal 2b: Ability to override fetch per async prop

Problem: different resources may be served from different servers and they may need different headers etc.

By supplying an `props` object to the loader objects, different `load` options could be needed for different props.

```js
  SomeBitmapLayer({
    data: DATA_URL,
    bitmap: BITMAP_URL,
    loadOptions: {
      props: {
        data: {
          fetch: url => companyInternalFetch(url)
        },
        bitmap: {
          fetch: {headers: EXTERNAL_SERVICE_HEADERS})
        }
      }
    }
  })
```

If an async prop isn't listed it will be fetched using the default fetch method.

```js
  SomeBitmapLayer({
    data: DATA_URL, // loaded with custom fetch
    bitmap: BITMAP_URL, // loaded with default fetch
    loadOptions: {
      fetch: {headers: {...}}
      props: {
        data: {
          fetch: {headers: {...}}
        }
      }
    }
  })
```

Redefining default AND specific fetch
```js
  SomeBitmapLayer({
    data: DATA_URL, // loaded with custom fetch
    bitmap: BITMAP_URL, // loaded with default fetch
    loadOptions: {
      fetch: {headers: {...}}
      props: {
        data: {
          fetch: {headers: {...}}
        }
      }
    }
  })
```

deck.gl would look for per-prop overrides and merge and remove them before passing the options to loaders.gl


### Proposal 3c: Ensure that loaders can be called outside of async props

Sometimes, a loader called by the parse function needs contextual information. For instance, the ScenegraphLoader cannot work without a `gl` context being passed in.

Design Notes:
- Can we make any changes to loaders.gl so that layers can rely on the globally registered loaders to minimize the need to make special loader lists for specific
- Sometimes the layer may just need to pass some options to the pre-registered loader. CSV header flag, gl context to scenegraph laoder.


### Proposal 4: Add 'onData' callback

The new `onData` callback is called whenever the layer sees new `data`, either as a result of an async load completing, or just as a result of new sync data being supplied to the layer.

This allows app to use the convenience of async `data` URL props, even when they need to do some final processing, perhaps extract some small piece of information from the data to update the view state.

For instance, the `PointCloudLayer` example uses the bounding box of the point cloud to initialize `viewState` for the `OrbitController`.

BEFORE:
```js
const data = await fetch(LAZ_SAMPLE);
_setViewStateFromPointCloud(data)); // Calculate View State from header

new PointCloudLayer({
  data
});
```

AFTER:
```js
new PointCloudLayer({
  data: LAZ_SAMPLE,
  // NEW: Provide a callback to let application react to loaded/parsed/transformed data
  onData: data => this._setViewStateFromPointCloud(data)
});
```

Design Notes:
- It is assumed that the `onData` callback should be called only once during batched streaming (when all batches have arrived). The batched loading RFC might add an `onDataBatch` callback that is called after each batch.
- Why support onLoad callbacks for the `data` prop only? This callback was added to let apps react to the completed loading of async `data` props. Like other affordances for async props, one can imagine that similar callbacks could be useful for other async props...
- The original proposed callback name was `onDataLoaded`. Reviewers pointed out that it would be useful to call this function should be called even when pre-parsed data is supplied. The new name (`onData`) reflects this change. Other options: `onDataAvailable`, `onDataUpdated`.


### Proposal 5: Make PointCloudLayer accept a "Geometry-shaped" object

Today custom code is required to extract the positions attribute etc and pass in as top-level props, see the PointCloudLayer example.

BEFORE:
```js
fetch(LAZ_SAMPLE).then(...); // Extract numInstances and positions, calculate View State

new PointCloudLayer({
  coordinateSystem: COORDINATE_SYSTEM.IDENTITY,
  numInstances: state.pointsCount,
  instancePositions: state.points
});
```

AFTER:
```js
import {parse, registerLoaders} from '@loaders.gl/core';
import {LAZLoader} from '@loaders.gl/las';
registerLoaders(LAZLoader);

new PointCloudLayer({
  coordinateSystem: COORDINATE_SYSTEM.IDENTITY,
  data: LAZ_SAMPLE,
  parse // NEW: See above
});
```

### Proposal: Update deck.gl/json to use loaders.gl integration

Instead of importing d3-csv etc.


## Ideas: Potential Proposals

These ideas still need some work to become formal proposals

### Idea: Allow fetch/parse to be redefined on deck.gl level.

Instead of having to pass `fetch` and `parse` to each layer, maybe just allow the user to set defaults on `Deck`.

### Idea: loaders.gl loader modules autoregister their loaders

This is a proposal for loaders.gl, but mentioned here for completeness:

Many apps could be slightly more elegant if loaders.gl loader modules auto-registered their loaders. With the right deck.gl integration, simply importing a loader module would make that loader available to the async props of deck.gl layers.

Comparing the point cloud example above:

```js
import {LAZLoader} from '@loaders.gl/las';

new PointCloudLayer({
  coordinateSystem: COORDINATE_SYSTEM.IDENTITY,
  data: LAZ_SAMPLE
});
```

While such "pre-registration" would be trivial to implemented, there are some concerns:

- Which loader(s) to register: The default main-thread loader, the streaming loader, the  worker thread loader. All of them?
- Tree-shaking: A loader module could export multiple loaders. By auto registering all of them, we might defeat tree-shaking (a modest concern, since we are already publishing loaders a-la-carte).
- Increased dependency: Currently simple loader modules can be written without importing any loaders.gl helper libraries (`@loaders.gl/loader-utils`). If the loader modules have to import `registerLoaders` that changes. This is a design simplicity/elegance in loaders.gl  that matters to some people, that would be lost for this convenience.
- Manual registration code? - To avoid having to import `@loaders.gl/loader-utils` in each loader module, we could just ask each loader to push their loader a global array. But even then, the global scope must be determined, normally by helper function in loaders.gl.


## Rejected Proposals

## Rejected Proposal: Ability to specify different defaultProps for fetch

Assuming we make it easy to write custom loaders, there does not seem to be a strong use case for layers providing different defaults for fetch.

```js
const defaultProps = {
  bitmap: {async: true},
  fetch: {
    data: url => d3.csv(url)
  }
}
```

Design Notes:
- We would need to clarify how individual fetch functions are merged between defaults and overrides.

## Rejected Proposal: Add `parse` prop to specify how data should be parsed

> No longer needed with extended option support in loaders.gl

```js
import {parse, registerLoaders} from '@loaders.gl/core';
import {CSVLoader} from '@loaders.gl/csv';
registerLoaders(CSVLoader);

new AnyLayer({
  coordinateSystem: COORDINATE_SYSTEM.IDENTITY,
  data: CSV_URL,
  // NEW: Accept a parse methods
  parse,
});
```

There are two ways to specify a custom loader that works with the deck.gl async prop loading:

- Defining a fetch function that loads and parses.

Do we expect `parse` functions to support different input data.


The `parse` prop is expected to be either a function or a (list of) loaders.gl loaders that can be passed to `parse`.

Design Notes:
- The requirement to wrap custom loaders as loaders.gl loader objects: loaders.gl `parse` is flexible and accepts a fetch response object as its preferred (most  flexiable/efficient input). It is fair to assume that not all custom loaders support a variety of objects. By registering a custom loaders

##@ Rejected Proposal: Async props can be object

Alternative design, we could let async props be objects with all their load options.

But this overload would conflict with data actually being objects (like binary data).

```js
  SomeBitmapLayer({
    data: {
      url: DATA_URL,
      fetch: url => fetch(url, {headers: {...}}),
      parse: ...
    },
    bitmap: BITMAP_URL,
  })
```

```js
  SomeBitmapLayer({
    data: DATA_URL, // loaded with custom fetch
    bitmap: BITMAP_URL, // loaded with default fetch
    fetch: {
      data: url => fetch(url, {headers: {...}}),
    }
  })
```
