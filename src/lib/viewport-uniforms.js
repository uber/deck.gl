import {vec4} from 'gl-matrix';
import {Matrix4, Vector4} from 'luma.gl';

import assert from 'assert';
import {COORDINATE_SYSTEM} from './constants';

function fp64ify(a) {
  const hiPart = Math.fround(a);
  const loPart = a - Math.fround(a);
  return [hiPart, loPart];
}

/**
 * Returns uniforms for shaders based on current projection
 * includes: projection matrix suitable for shaders
 *
 * TODO - Ensure this works with any viewport, not just WebMercatorViewports
 *
 * @param {WebMercatorViewport} viewport -
 * @return {Float32Array} - 4x4 projection matrix that can be used in shaders
 */
export function getUniformsFromViewport(viewport, {
  modelMatrix = null,
  projectionMode = COORDINATE_SYSTEM.LNGLAT,
  positionOrigin = [0, 0]
} = {}) {
  // calculate WebGL matrices
  // TODO - could be cached for e.g. modelMatrix === null
  const matrices = getMatrices({
    viewport,
    modelMatrix,
    offsetMode: projectionMode !== COORDINATE_SYSTEM.LNGLAT
  });

  const {modelViewProjectionMatrix, viewProjectionMatrix, scale, pixelsPerMeter} = matrices;
  assert(modelViewProjectionMatrix, 'Viewport missing modelViewProjectionMatrix');
  assert(scale, 'Viewport scale missing');
  assert(pixelsPerMeter, 'Viewport missing pixelsPerMeter');

  // Convert to Float32
  const glProjectionMatrix = new Float32Array(modelViewProjectionMatrix);

  // "Float64Array"
  // Transpose the projection matrix to column major for GLSL.
  const glProjectionMatrixFP64 = new Float32Array(32);
  for (let i = 0; i < 4; ++i) {
    for (let j = 0; j < 4; ++j) {
      [
        glProjectionMatrixFP64[(i * 4 + j) * 2],
        glProjectionMatrixFP64[(i * 4 + j) * 2 + 1]
      ] = fp64ify(modelViewProjectionMatrix[j * 4 + i]);
    }
  }

  const positionOriginPixels = viewport.projectFlat(positionOrigin);

  const projectionCenter = vec4.transformMat4([],
    new Vector4(positionOriginPixels[0], positionOriginPixels[1], 0.0, 1.0),
    viewProjectionMatrix
  );

  console.log(viewport, positionOriginPixels, projectionCenter); // eslint-disable-line

  return {
    // Projection mode values
    projectionMode,
    projectionCenter,

    // Main projection matrices
    projectionMatrix: glProjectionMatrix,
    projectionMatrixUncentered: glProjectionMatrix,
    projectionFP64: glProjectionMatrixFP64,
    projectionPixelsPerUnit: matrices.pixelsPerMeter,
    projectionScale: matrices.scale,
    projectionScaleFP64: fp64ify(matrices.scale)
  };
}

function getMatrices({viewport, modelMatrix = null, offsetMode = false} = {}) {
  const modelViewProjectionMatrix = new Matrix4()
    // Always apply projection matrix
    .multiplyRight(viewport.projectionMatrix)
    // Apply centered or uncentered matrix depending on mode
    .multiplyRight(offsetMode ? viewport.viewMatrixUncentered : viewport.viewMatrix);

  if (modelMatrix) {
    // Apply model matrix if supplied
    modelViewProjectionMatrix.multiplyRight(modelMatrix);
  }

  const matrices = {
    modelViewProjectionMatrix,
    viewProjectionMatrix: viewport.viewProjectionMatrix,
    viewMatrix: viewport.viewMatrix,
    projectionMatrix: viewport.projectionMatrix,
    width: viewport.width,
    height: viewport.height,
    scale: viewport.scale
  };
    // Subclass can add additional params
    // TODO - Fragile: better to make base Viewport class aware of all params
  Object.assign(matrices, viewport._getParams());

  return matrices;
}
