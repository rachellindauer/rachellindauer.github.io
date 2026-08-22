// A living background: my first shader (June 2026) adapted from
// vj-visuals/code/glsl/cellular-worley.glsl — the breathing cellular field,
// without the portrait. Runs behind the homepage at whisper volume.
//
// Politeness rules: renders a single still frame if the visitor prefers
// reduced motion, pauses when the tab is hidden, caps resolution for battery,
// and if WebGL isn't available the page simply stays plain.

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var darkScheme = window.matchMedia("(prefers-color-scheme: dark)");

  var canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;";
  document.body.prepend(canvas);

  var gl = canvas.getContext("webgl", { antialias: false, alpha: false });
  if (!gl) { canvas.remove(); return; }

  var VERT =
    "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";

  // The field: hash2 / cellPoint / voronoiBorder are my original shader code.
  var FRAG = [
    "precision mediump float;",
    "uniform vec2 iResolution;",
    "uniform float iTime;",
    "uniform vec3 uBg;",     // page background color
    "uniform vec3 uInk;",    // cell-wall color
    "uniform float uAmt;",   // how loudly the field speaks (0..1)",
    "",
    "vec2 hash2(vec2 p){",
    "  p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));",
    "  return fract(sin(p)*43758.5453);",
    "}",
    "vec2 cellPoint(vec2 id,float t){",
    "  vec2 o=hash2(id);",
    "  o+=0.12*sin(t*0.6+6.2831*o);",  // motion amount, straight from the original
    "  return o;",
    "}",
    "float voronoiBorder(vec2 uv,float t){",
    "  vec2 cell=floor(uv);vec2 frac=fract(uv);",
    "  vec2 mr=vec2(0.);float md=8.;",
    "  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){",
    "    vec2 g=vec2(float(x),float(y));",
    "    vec2 o=cellPoint(cell+g,t);",
    "    vec2 r=g+o-frac;float d=dot(r,r);",
    "    if(d<md){md=d;mr=r;}",
    "  }",
    "  md=8.;",
    "  for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){",
    "    vec2 g=vec2(float(x),float(y));",
    "    vec2 o=cellPoint(cell+g,t);",
    "    vec2 r=g+o-frac;",
    "    vec2 diff=mr-r;",
    "    if(dot(diff,diff)>0.00001){",
    "      float d=dot(0.5*(mr+r),normalize(r-mr));",
    "      md=min(md,d);",
    "    }",
    "  }",
    "  return md;",
    "}",
    "void main(){",
    "  vec2 uv=(gl_FragCoord.xy*2.0-iResolution.xy)/iResolution.y;",
    "  float density=5.0;",                      // bigger, calmer cells than the original
    "  float border=voronoiBorder(uv*density,iTime*0.5);",
    "  float wall=1.0-smoothstep(0.0,0.05,border);",  // 1 on the wall, 0 inside cells
    "  float fade=smoothstep(-0.2,1.1,uv.y);",   // strongest up top, gone by mid-page
    "  vec3 col=mix(uBg,uInk,wall*fade*uAmt);",
    "  gl_FragColor=vec4(col,1.0);",
    "}"
  ].join("\n");

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
    return s;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.remove(); return; }

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
  gl.useProgram(prog);

  // One full-screen triangle.
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(prog, "iResolution");
  var uTime = gl.getUniformLocation(prog, "iTime");
  var uBg = gl.getUniformLocation(prog, "uBg");
  var uInk = gl.getUniformLocation(prog, "uInk");
  var uAmt = gl.getUniformLocation(prog, "uAmt");

  // Colors matched to the stylesheet's variables, per theme.
  function applyTheme() {
    if (darkScheme.matches) {
      gl.uniform3f(uBg, 0.110, 0.102, 0.094);  // #1c1a18
      gl.uniform3f(uInk, 0.910, 0.894, 0.871); // #e8e4de
      gl.uniform1f(uAmt, 0.10);
    } else {
      gl.uniform3f(uBg, 0.980, 0.976, 0.969);  // #faf9f7
      gl.uniform3f(uInk, 0.165, 0.153, 0.137); // #2a2723
      gl.uniform1f(uAmt, 0.08);
    }
  }
  applyTheme();
  darkScheme.addEventListener("change", function () { applyTheme(); draw(last); });

  function resize() {
    var scale = 0.5; // quarter the pixels: plenty for soft cells, kind to batteries
    canvas.width = Math.max(1, Math.floor(innerWidth * scale));
    canvas.height = Math.max(1, Math.floor(innerHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  }
  addEventListener("resize", function () { resize(); draw(last); });
  resize();

  var start = performance.now();
  var last = start;
  var raf = null;

  function draw(now) {
    last = now;
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function loop(now) {
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  if (reduceMotion) {
    draw(start); // one still frame, no animation
  } else {
    raf = requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
      } else if (!raf) {
        raf = requestAnimationFrame(loop);
      }
    });
  }
})();
