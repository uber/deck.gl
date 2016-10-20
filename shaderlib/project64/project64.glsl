const vec2 WORLD_SCALE_FP64 = vec2(81.4873275756836, 0.0000032873668232014097);

uniform vec2 projectionScaleFP64;
uniform vec2 projectionFP64[16];

void mercatorProject_fp64(vec4 lnglat_fp64, out vec2 out_val[2]) { //longitude: lnglat_fp64.xy; latitude: lnglat_fp64.zw

  out_val[0] = sum_fp64(radians_fp64(lnglat_fp64.xy), PI_FP64);
  out_val[1] = sub_fp64(PI_FP64, log_fp64(tan_fp64(sum_fp64(PI_FP64 * 0.25, radians_fp64(lnglat_fp64.zw) * 0.5))));
  return;
}

void preproject_fp64(vec4 position_fp64, out vec2 out_val[2]) {

  vec2 pos_fp64[2];
  mercatorProject_fp64(position_fp64, pos_fp64);
  vec2 x_fp64 = mul_fp64(pos_fp64[0], projectionScaleFP64);
  vec2 y_fp64 = mul_fp64(pos_fp64[1], projectionScaleFP64);
  out_val[0] = mul_fp64(x_fp64, WORLD_SCALE_FP64);
  out_val[1] = mul_fp64(y_fp64, WORLD_SCALE_FP64);

  return;
}

void project_to_clipspace_fp64(vec2 vertex_pos_modelspace[4], out vec2 vertex_pos_clipspace[4]) {
  mat4_vec4_mul_fp64(projectionFP64, vertex_pos_modelspace, vertex_pos_clipspace);
}
