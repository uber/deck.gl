import {log} from '@deck.gl/core';
import CartoLayer from './carto-layer';
import {MODE, MAP_TYPES} from '../api';

const defaultProps = {
  ...CartoLayer.defaultProps,
  mode: MODE.CARTO,
  type: MAP_TYPES.SQL,
  uniqueIdProperty: 'cartodb_id'
};

export default class CartoSQLLayer extends CartoLayer {
  constructor(...args) {
    super(...args);

    log.warn(
      'CARTO warning: CartoSQLLayer will be removed in the following deck.gl versions, and they are not recommended to use. Use CartoLayer instead.'
    )();
  }
}

CartoSQLLayer.layerName = 'CartoSQLLayer';
CartoSQLLayer.defaultProps = defaultProps;