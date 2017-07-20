import {Layer} from 'deck.gl';
import {GL, Model, Geometry, Buffer, TransformFeedback, setParameters, loadTextures} from 'luma.gl';
import ProgramTransformFeedback from './program-transform-feedback';

import DelaunayInterpolation from '../delaunay-interpolation/delaunay-interpolation';
import {ELEVATION_DATA_IMAGE, ELEVATION_DATA_BOUNDS, ELEVATION_RANGE} from '../../defaults';

import vertex from './particle-layer-vertex.glsl';
import fragment from './particle-layer-fragment.glsl';
import vertexTF from './transform-feedback-vertex.glsl';
import fragmentTF from './transform-feedback-fragment.glsl';

const defaultProps = {
  boundingBox: null,
  originalBoundingBox: null,
  texData: null,
  zScale: 1,
  time: 0
};

export default class ParticleLayer extends Layer {
  getShaders() {
    return {
      vs: vertex,
      fs: fragment
    };
  }

  initializeState() {
    const {gl} = this.context;
    const {boundingBox, texData, originalBoundingBox} = this.props;

    loadTextures(gl, {
      urls: [ELEVATION_DATA_IMAGE],
      parameters: {
        parameters: {
          [GL.TEXTURE_MAG_FILTER]: GL.LINEAR,
          [GL.TEXTURE_MIN_FILTER]: GL.LINEAR,
          [GL.TEXTURE_WRAP_S]: GL.CLAMP_TO_EDGE,
          [GL.TEXTURE_WRAP_T]: GL.CLAMP_TO_EDGE
        }
      }
    }).then(textures => {
      this.setState({elevationTexture: textures[0]});
    });

    const {textureSize} = this.props.texData;
    const {width, height} = textureSize;
    const textureFrom = this.createTexture(gl, {width, height});
    const textureTo = this.createTexture(gl, {width, height});

    const model = this.getModel({
      gl, boundingBox, originalBoundingBox, nx: 1200, ny: 600, texData
    });

    this.setupTransformFeedback({gl, boundingBox, nx: 1200, ny: 600});

    const modelTF = this.getModelTF({
      gl, boundingBox, originalBoundingBox, nx: 1200, ny: 600, texData
    });

    this.setState({
      model,
      modelTF,
      texData,
      textureFrom,
      textureTo,
      width,
      height
    });
  }

  updateState({props, oldProps, changeFlags: {dataChanged, somethingChanged}}) {
    const {time} = this.props;
    const timeInterval = Math.floor(time);
    const delta = time - timeInterval;
    this.setState({
      timeInterval,
      delta
    });
  }

  /* eslint-disable max-statements */
  draw({uniforms}) {
    // Return early if elevationTexture is not loaded.
    if (!this.state.elevationTexture) {
      return;
    }
    const {gl} = this.context;

    const props = this.props;
    const {boundingBox, texData} = this.props;
    const {dataBounds} = texData;

    this.runTransformFeedback({gl});

    const {model, textureFrom, textureTo, delta} = this.state;
    const {textureArray} = texData;
    const {
      width, height,
      elevationTexture,
      bufferTo, bufferFrom,
      timeInterval
    } = this.state;

    const currentUniforms = {
      boundingBox: [boundingBox.minLng, boundingBox.maxLng, boundingBox.minLat, boundingBox.maxLat],
      bounds0: [dataBounds[0].min, dataBounds[0].max],
      bounds1: [dataBounds[1].min, dataBounds[1].max],
      bounds2: [dataBounds[2].min, dataBounds[2].max],
      color0: [83, 185, 148].map(d => d / 255),
      color1: [255, 255, 174].map(d => d / 255),
      color2: [241, 85, 46].map(d => d / 255),
      dataFrom: textureFrom,
      dataTo: textureTo,
      elevationTexture,
      elevationBounds: ELEVATION_DATA_BOUNDS,
      elevationRange: ELEVATION_RANGE,
      zScale: props.zScale,
      delta // TODO: looks to be 0 always , verify.
    };

    setParameters(gl, {
      blend: true,
      blendFunc: [gl.SRC_ALPHA, gl.ONE]
    });
    const pixelStoreParameters = {
      [GL.UNPACK_FLIP_Y_WEBGL]: true
    };

    textureFrom.setImageData({
      pixels: textureArray[timeInterval],
      width,
      height,
      format: gl.RGBA32F,
      type: gl.FLOAT,
      dataFormat: gl.RGBA,
      parameters: pixelStoreParameters
    });

    textureTo.setImageData({
      pixels: textureArray[timeInterval + 1],
      width,
      height,
      format: gl.RGBA32F,
      type: gl.FLOAT,
      dataFormat: gl.RGBA,
      parameters: pixelStoreParameters
    });

    model.setAttributes({
      posFrom: bufferFrom
    });

    model.render(Object.assign({}, currentUniforms, uniforms));

    // Swap the buffers
    this.setState({
      bufferFrom: bufferTo,
      bufferTo: bufferFrom
    });
  }

  setupTransformFeedback({gl, boundingBox, nx, ny}) {
    const positions4 = this.calculatePositions4({boundingBox, nx, ny});

    const bufferFrom = new Buffer(gl, {
      size: 4, data: positions4, usage: gl.DYNAMIC_COPY});

    const bufferTo = new Buffer(gl, {
      size: 4, bytes: 4 * positions4.length, usage: gl.DYNAMIC_COPY});

    const transformFeedback = new TransformFeedback(gl, {});

    this.setState({
      counter: 0,
      bufferFrom,
      bufferTo,
      transformFeedback
    });
  }

  runTransformFeedback({gl}) {
    // Run transform feedback
    const {modelTF, textureFrom, textureTo, delta} = this.state;

    const {boundingBox, originalBoundingBox} = this.props;
    const {dataBounds, textureArray, textureSize} = this.props.texData;
    const {width, height} = textureSize;
    const timeInterval = 0;

    let now = Date.now();

    const {bufferFrom, bufferTo} = this.state;
    let {counter} = this.state;

    // onBeforeRender
    const time = Date.now() - now;
    let flip = time > 500 ? 1 : -1;
    if (flip > 0) {
      counter = (counter + 1) % 10;
      flip = counter;
    }

    if (flip > 0) {
      flip = -1;
      now = Date.now();
    }

    const pixelStoreParameters = {
      [GL.UNPACK_FLIP_Y_WEBGL]: true
    };

    textureFrom.setImageData({
      pixels: textureArray[timeInterval],
      width,
      height,
      format: gl.RGBA32F,
      type: gl.FLOAT,
      dataFormat: gl.RGBA,
      parameters: pixelStoreParameters
    });

    textureTo.setImageData({
      pixels: textureArray[timeInterval + 1],
      width,
      height,
      format: gl.RGBA32F,
      type: gl.FLOAT,
      dataFormat: gl.RGBA,
      parameters: pixelStoreParameters
    });

    modelTF.program.use();
    const {transformFeedback} = this.state;

    modelTF.setAttributes({
      posFrom: bufferFrom
    });

    transformFeedback.bindBuffers(
      {
        0: bufferTo
      },
      {
        clear: true
      });

    transformFeedback.begin(gl.POINTS);

    const uniforms = {
      boundingBox: [
        boundingBox.minLng, boundingBox.maxLng,
        boundingBox.minLat, boundingBox.maxLat
      ],
      originalBoundingBox: [
        originalBoundingBox.minLng, originalBoundingBox.maxLng,
        originalBoundingBox.minLat, originalBoundingBox.maxLat
      ],
      bounds0: [dataBounds[0].min, dataBounds[0].max],
      bounds1: [dataBounds[1].min, dataBounds[1].max],
      bounds2: [dataBounds[2].min, dataBounds[2].max],
      dataFrom: textureFrom,
      dataTo: textureTo,
      time,
      flip,
      delta // TODO: looks to be 0 always , verify.
    };

    const parameters = {
      [GL.RASTERIZER_DISCARD]: true
    };

    modelTF.draw({uniforms, parameters});

    transformFeedback.end();

    this.setState({
      counter
    });
  }
  /* eslint-enable max-statements */

  getModelTF({gl, boundingBox, originalBoundingBox, nx, ny, texData}) {
    const positions3 = this.calculatePositions3({nx, ny});

    const modelTF = new Model(gl, {
      id: 'ParticleLayer-modelTF',
      program: new ProgramTransformFeedback(gl, {
        vs: vertexTF,
        fs: fragmentTF
      }),
      geometry: new Geometry({
        id: this.props.id,
        drawMode: GL.POINTS,
        isInstanced: false,
        attributes: {
          positions: {size: 3, type: gl.FLOAT, value: positions3}
        }
      }),
      isIndexed: false,
      isInstanced: false
    });

    return modelTF;
  }

  getModel({gl, nx, ny, texData}) {
    // This will be a grid of elements
    this.state.numInstances = nx * ny;

    const positions3 = this.calculatePositions3({nx, ny});

    return new Model(gl, {
      id: 'ParticleLayer-model',
      vs: vertex,
      fs: fragment,
      geometry: new Geometry({
        id: this.props.id,
        drawMode: GL.POINTS,
        attributes: {
          positions: {size: 3, type: GL.FLOAT, value: positions3},
          vertices: {size: 3, type: GL.FLOAT, value: positions3}
        }
      }),
      isIndexed: false
    });
  }

  getNumInstances() {
    return this.state.numInstances;
  }

  createTexture(gl, opt) {
    const options = {
      data: {
        format: gl.RGBA,
        value: false,
        type: opt.type || gl.FLOAT,
        internalFormat: opt.internalFormat || gl.RGBA32F,
        width: opt.width,
        height: opt.height,
        border: 0
      }
    };

    if (opt.parameters) {
      options.parameters = opt.parameters;
    }

    return new DelaunayInterpolation({gl})
      .createTextureNew(gl, options);
  }

  calculatePositions3({nx, ny}) {
    const positions3 = new Float32Array(nx * ny * 3);

    for (let i = 0; i < nx; ++i) {
      for (let j = 0; j < ny; ++j) {
        const index3 = (i + j * nx) * 3;
        positions3[index3 + 0] = 0;
        positions3[index3 + 1] = 0;
        positions3[index3 + 2] = Math.random() * nx;
      }
    }

    return positions3;
  }

  calculatePositions4({boundingBox, nx, ny}) {
    const diffX = boundingBox.maxLng - boundingBox.minLng;
    const diffY = boundingBox.maxLat - boundingBox.minLat;
    const spanX = diffX / (nx - 1);
    const spanY = diffY / (ny - 1);

    const positions4 = new Float32Array(nx * ny * 4);

    for (let i = 0; i < nx; ++i) {
      for (let j = 0; j < ny; ++j) {
        const index4 = (i + j * nx) * 4;
        positions4[index4 + 0] = i * spanX + boundingBox.minLng;
        positions4[index4 + 1] = j * spanY + boundingBox.minLat;
        positions4[index4 + 2] = -1;
        positions4[index4 + 3] = -1;
      }
    }

    return positions4;
  }
}

ParticleLayer.layerName = 'ParticleLayer';
ParticleLayer.defaultProps = defaultProps;
