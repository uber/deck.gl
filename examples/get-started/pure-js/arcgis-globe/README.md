<div align="center">
   <img width="150" heigth="150" src="https://webpack.js.org/assets/icon-square-big.svg" />
</div>

## Example: Use deck.gl with Esri ArcGIS API for JavaScript

This sample shows how to use the `@deck.gl/arcgis` module to add a deck.gl layer to an [ArcGIS JavaScript](https://developers.arcgis.com/javascript/) app.
Uses [Webpack](https://github.com/webpack/webpack) and the [ArcGIS Webpack plugin](https://github.com/Esri/arcgis-webpack-plugin)
to bundle files and serves it with [webpack-dev-server](https://webpack.js.org/guides/development/#webpack-dev-server).

## Usage

To install dependencies:

```bash
npm install
# or
yarn
```

Commands:
* `npm start` is the development target, to serve the app and hot reload.
* `npm run build` is the production target, to create the final bundle and write to disk.
