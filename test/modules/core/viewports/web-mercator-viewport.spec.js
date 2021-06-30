// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import test from 'tape-catch';
import {equals, config, Vector3} from 'math.gl';
import {WebMercatorViewport} from 'deck.gl';
import {Matrix4} from 'math.gl';

// Adjust sensitivity of math.gl's equals
const LNGLAT_TOLERANCE = 1e-6;
const ALT_TOLERANCE = 1e-5;
const OFFSET_TOLERANCE = 1e-5;

const DEGREES_TO_RADIANS = Math.PI / 180;

/* eslint-disable */
const TEST_VIEWPORTS = [
  {
    width: 800,
    height: 600,
    latitude: 38,
    longitude: -122,
    zoom: 11
  },
  {
    width: 800,
    height: 600,
    latitude: 23,
    longitude: 20,
    zoom: 15,
    pich: 30,
    bearing: -85
  },
  {
    width: 800,
    height: 600,
    latitude: 65,
    longitude: 42,
    zoom: 16,
    pitch: 15,
    bearing: 30
  }
];

test('WebMercatorViewport#imports', t => {
  t.ok(WebMercatorViewport, 'WebMercatorViewport import ok');
  t.end();
});

test('WebMercatorViewport#constructor', t => {
  t.ok(
    new WebMercatorViewport() instanceof WebMercatorViewport,
    'Created new WebMercatorViewport with default args'
  );

  t.ok(
    new WebMercatorViewport(
      Object.assign({}, TEST_VIEWPORTS[0], {
        width: 0,
        height: 0
      })
    ) instanceof WebMercatorViewport,
    'WebMercatorViewport constructed successfully with 0 width and height'
  );
  t.end();
});

test('WebMercatorViewport.projectFlat', t => {
  const oldEpsilon = config.EPSILON;
  config.EPSILON = LNGLAT_TOLERANCE;

  for (const vc of TEST_VIEWPORTS) {
    const viewport = new WebMercatorViewport(vc);
    for (const tc of TEST_VIEWPORTS) {
      const lnglatIn = [tc.longitude, tc.latitude];
      const xy = viewport.projectFlat(lnglatIn);
      const lnglat = viewport.unprojectFlat(xy);
      t.comment(`Comparing [${lnglatIn}] to [${lnglat}]`);
      t.ok(equals(lnglatIn, lnglat));
    }
  }
  config.EPSILON = oldEpsilon;
  t.end();
});

test('WebMercatorViewport.project#3D', t => {
  const oldEpsilon = config.EPSILON;
  for (const vc of TEST_VIEWPORTS) {
    const viewport = new WebMercatorViewport(vc);
    for (const offset of [0, 0.5, 1.0, 5.0]) {
      const lnglatIn3 = [vc.longitude + offset, vc.latitude + offset, 0];
      const xyz3 = viewport.project(lnglatIn3);
      const lnglat3 = viewport.unproject(xyz3);
      t.comment(`Project/unproject ${lnglatIn3} => ${xyz3} => ${lnglat3}`);
      config.EPSILON = LNGLAT_TOLERANCE;
      t.ok(equals(lnglatIn3.slice(0, 2), lnglat3.slice(0, 2)), 'LngLat input/output match');
      config.EPSILON = ALT_TOLERANCE;
      t.ok(equals(lnglatIn3[2], lnglat3[2]), 'Altitude input/output match');
    }
  }
  config.EPSILON = oldEpsilon;
  t.end();
});

test('WebMercatorViewport.project#2D', t => {
  const oldEpsilon = config.EPSILON;
  config.EPSILON = LNGLAT_TOLERANCE;
  // Cross check positions
  for (const vc of TEST_VIEWPORTS) {
    const viewport = new WebMercatorViewport(vc);
    for (const tc of TEST_VIEWPORTS) {
      const lnglatIn = [tc.longitude, tc.latitude];
      const xy = viewport.project(lnglatIn);
      const lnglat = viewport.unproject(xy);
      t.comment(`Comparing [${lnglatIn}] to [${lnglat}]`);
      t.ok(equals(lnglatIn, lnglat));
    }
  }
  config.EPSILON = oldEpsilon;
  t.end();
});

test('WebMercatorViewport.getScales', t => {
  const oldEpsilon = config.EPSILON;
  config.EPSILON = OFFSET_TOLERANCE;

  for (const vc of TEST_VIEWPORTS) {
    const viewport = new WebMercatorViewport(vc);
    const distanceScales = viewport.getDistanceScales();
    t.ok(
      distanceScales.metersPerUnit &&
        distanceScales.unitsPerMeter &&
        distanceScales.degreesPerUnit &&
        distanceScales.unitsPerDegree,
      'distanceScales defined'
    );

    t.ok(
      equals(distanceScales.metersPerUnit.map((d, i) => d * distanceScales.unitsPerMeter[i]), [
        1,
        1,
        1
      ]),
      'metersPerUnit/unitsPerMeter match'
    );

    t.ok(
      equals(distanceScales.degreesPerUnit.map((d, i) => d * distanceScales.unitsPerDegree[i]), [
        1,
        1,
        1
      ]),
      'degreesPerUnit/unitsPerDegree match'
    );

    for (const offset of [-0.01, 0.005, 0.01]) {
      const xyz0 = [
        viewport.center[0] + distanceScales.unitsPerDegree[0] * offset,
        viewport.center[1] + distanceScales.unitsPerDegree[1] * offset
      ];
      const xyz1 = viewport.projectFlat([vc.longitude + offset, vc.latitude + offset, 0]);

      t.ok(equals(xyz0, xyz1), 'unitsPerDegree matches projection');
    }
  }
  config.EPSILON = oldEpsilon;
  t.end();
});

test('WebMercatorViewport.getFrustumPlanes', t => {
  const CULLING_TEST_CASES = [
    {
      pixels: [400, 300],
      result: null
    },
    {
      pixels: [799, 1],
      result: null
    },
    {
      pixels: [1, 599],
      result: null
    },
    {
      pixels: [799, 599],
      result: null
    },
    {
      pixels: [1, 1],
      result: null
    },
    {
      pixels: [-1, 300],
      result: 'left'
    },
    {
      pixels: [801, 300],
      result: 'right'
    },
    {
      pixels: [400, -1],
      result: 'top'
    },
    {
      pixels: [400, 601],
      result: 'bottom'
    },
    {
      pixels: [400, 300, -1.01],
      result: 'near'
    },
    {
      pixels: [400, 300, 1.01],
      result: 'far'
    }
  ];

  for (const vc of TEST_VIEWPORTS) {
    const viewport = new WebMercatorViewport(vc);
    const planes = viewport.getFrustumPlanes();

    for (const tc of CULLING_TEST_CASES) {
      const lngLat = viewport.unproject(tc.pixels);
      const commonPosition = viewport.projectPosition(lngLat);
      t.is(getCulling(commonPosition, planes), tc.result, 'point culled');
    }
  }
  t.end();
});

test('WebMercatorViewport.subViewports', t => {
  let viewport = new WebMercatorViewport(TEST_VIEWPORTS[0]);
  t.deepEqual(viewport.subViewports, null, 'gets correct subViewports');

  viewport = new WebMercatorViewport({...TEST_VIEWPORTS[0], repeat: true});
  t.deepEqual(viewport.subViewports, [viewport], 'gets correct subViewports');

  viewport = new WebMercatorViewport({
    width: 800,
    height: 400,
    longitude: 0,
    latitude: 0,
    zoom: 0,
    repeat: true
  });
  const {subViewports} = viewport;
  t.is(subViewports.length, 3, 'gets correct subViewports');
  t.deepEqual(
    subViewports[0].project([0, 0]),
    [400 - 512, 200],
    'center offset in subViewports[0]'
  );
  t.deepEqual(subViewports[1].project([0, 0]), [400, 200], 'center offset in subViewports[1]');
  t.deepEqual(
    subViewports[2].project([0, 0]),
    [400 + 512, 200],
    'center offset in subViewports[2]'
  );

  t.is(viewport.subViewports, subViewports, 'subViewports are cached');

  t.end();
});

test('WebMercatorViewport.projectionMatrix', t => {
  const opts = {...TEST_VIEWPORTS[0]};

  const fovy = 25;
  const projectionMatrix = new Matrix4().perspective({
    fovy: fovy * DEGREES_TO_RADIANS,
    aspect: opts.width / opts.height,
    near: 0.1,
    far: 10
  });
  let viewport = new WebMercatorViewport({projectionMatrix, ...opts});
  t.deepEqual(viewport.fovy, fovy, 'fovy is passed through');
  t.end();
});

function getCulling(p, planes) {
  let outDir = null;
  p = new Vector3(p);
  for (const dir in planes) {
    const plane = planes[dir];
    if (p.dot(plane.normal) > plane.distance) {
      outDir = dir;
      break;
    }
  }
  return outDir;
}
