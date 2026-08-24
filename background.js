// A living background: the cell field from my VJ work, assembling into a pair
// of eyes and dissolving again. Generated from
// vj-visuals/projects/face-emerge/site/ (build_site_bg.py then emit_js.py).
// Hand-edits here get overwritten; change it there.
//
// How it works, briefly. Every cell is grown from a single point, and the walls
// you see are the exact halfway lines between neighbouring points. Because the
// halfway line between two points is always perfectly straight, no line in this
// can ever curve. The points sit in pairs straddling the traced line of an eye,
// so the wall between each pair lands right on it. Most of the time the points
// are spread evenly and there is nothing to see; then they travel to their eye
// positions, hold for an instant, and drift apart again.
//
// Politeness rules, same as the shader this replaces: a single still frame if
// the visitor prefers reduced motion, paused when the tab is hidden, capped
// frame rate and resolution for batteries, resolution dropped automatically if
// the machine is struggling, and if WebGL isn't available the page just stays
// plain.

(function () {
  "use strict";

  // ---- the dials ---------------------------------------------------------
  var GROW = 30.0;        // seconds for the eyes to assemble
  var MELT = 38.0;        // seconds to dissolve. One breath is the sum.
  var TRAVEL_IN = 0.45;   // fraction of the window ONE point takes
  var TRAVEL_OUT = 0.40;
  var ARC = 0.015217;        // how far each point bows on its way in
  var DRIFT = 0.010870;    // how far points wander when there are no eyes
                              // (both in normalised units, see the shader note)
  var DRIFT_SPEED = 0.16;
  var WALL_PX = 1.0;          // line weight, in canvas pixels
  var AMT_LIGHT = 0.10;       // how loudly the field speaks. Her old shader
  var AMT_DARK = 0.12;        // used 0.08 / 0.10.

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var darkScheme = window.matchMedia("(prefers-color-scheme: dark)");

  var canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;";
  document.body.prepend(canvas);

  var gl = canvas.getContext("webgl", { antialias: false, alpha: false });
  if (!gl) { canvas.remove(); return; }

  // ---- the points -------------------------------------------------------
  var N = 240;
  var FACE = new Float32Array([0.32236,0.54934,0.31679,0.54022,0.34415,0.54528,0.33034,0.52268,0.36467,0.52554,0.36467,0.51022,0.39649,0.52421,0.39649,0.51155,0.41483,0.53117,0.41483,0.50459,0.43843,0.53083,0.45236,0.51056,0.45793,0.53844,0.46645,0.52604,0.48183,0.56246,0.49744,0.53975,0.46822,0.56197,0.47967,0.58070,0.43240,0.58737,0.44072,0.60098,0.41836,0.59006,0.41836,0.60113,0.39492,0.58793,0.39492,0.60326,0.36337,0.58177,0.36337,0.60943,0.34019,0.57213,0.32876,0.58876,0.32110,0.56144,0.31194,0.57476,0.30657,0.55403,0.29982,0.56384,0.62029,0.56424,0.60849,0.54493,0.65585,0.54329,0.64336,0.52285,0.67995,0.52896,0.66711,0.50794,0.70102,0.52497,0.70102,0.51079,0.73925,0.52847,0.73925,0.50729,0.76701,0.53607,0.77447,0.52522,0.79514,0.55560,0.80278,0.54449,0.76009,0.57533,0.76998,0.59152,0.74279,0.58202,0.75614,0.60386,0.71943,0.58591,0.71943,0.60528,0.68575,0.58215,0.68575,0.60905,0.63415,0.56497,0.62689,0.57553,0.29238,0.50237,0.29212,0.49028,0.32253,0.50558,0.32210,0.48577,0.33822,0.51037,0.33757,0.48032,0.37452,0.50035,0.37427,0.48878,0.42972,0.50055,0.42942,0.48621,0.47025,0.49973,0.46995,0.48530,0.59546,0.48495,0.59688,0.46767,0.60744,0.49048,0.60960,0.46417,0.64387,0.49373,0.64608,0.46692,0.66873,0.48782,0.66963,0.47681,0.68777,0.48945,0.68869,0.47831,0.73106,0.49497,0.73230,0.47993,0.75114,0.50360,0.75351,0.47470,0.78090,0.50610,0.78329,0.47709,0.79779,0.50009,0.79897,0.48578,0.84205,0.50740,0.84383,0.48579,0.39891,0.55674,0.70978,0.55674,0.43969,1.04773,0.22872,0.34641,0.28153,0.87950,0.95894,0.73412,0.28315,1.04002,1.17078,0.65135,0.42431,0.79450,0.86195,0.80007,0.45781,0.65571,0.76458,1.04124,-0.09659,0.37038,0.61695,0.38769,0.07569,0.95970,0.58704,0.84768,0.48802,0.98611,1.06125,0.64649,0.55295,0.74866,0.56626,0.32764,-0.07529,0.96801,0.03943,0.88220,-0.07377,0.81447,-0.01767,0.35045,1.19599,0.73570,-0.14344,0.76796,1.17627,0.47439,1.04985,0.46614,1.03211,0.77447,1.24562,1.09993,-0.11121,0.44718,0.97042,1.00249,1.22129,0.94949,0.27523,0.74625,0.84268,0.34275,0.32659,0.37286,0.12743,0.42200,1.08327,0.90742,0.99114,0.60775,1.09307,0.52972,0.14984,0.78973,1.12604,0.77208,0.44867,0.37462,0.04404,0.79023,0.65896,0.70407,-0.00849,0.45831,0.10571,0.69853,0.01060,0.61992,0.06074,1.06835,0.65287,0.78184,1.09055,1.08266,0.95684,0.40911,0.36364,0.70597,1.13956,0.85761,-0.15017,0.58964,0.15580,0.93212,0.89734,0.56121,0.61906,1.01029,0.14250,0.52900,-0.14499,0.51561,1.26011,0.83135,0.76254,0.95010,0.54525,0.60195,0.52389,0.88679,0.35928,1.00071,0.84066,0.98247,0.77935,0.83325,0.67698,0.33451,0.24858,0.63677,0.21320,0.44379,-0.08740,0.88792,1.12469,0.31493,1.27005,0.50374,1.19856,0.30349,0.88215,0.64736,1.15988,0.38556,-0.06682,1.08951,0.96922,0.48361,0.75770,0.31405,0.70144,0.42574,0.05168,0.39790,1.11786,1.00829,0.37195,0.30877,0.12999,0.32731,1.05587,0.34646,1.25274,0.59368,1.21929,1.02414,0.79383,0.65485,-0.03324,0.73654,0.99180,0.92154,0.41638,0.95050,0.55346,1.08756,0.39985,0.43812,0.08978,0.61299,-0.13488,0.66852,0.23237,0.55826,0.85791,0.43532,1.01290,1.08776,1.25880,0.42251,0.78507,0.73658,0.22257,0.80614,0.95039,0.83970,0.93269,0.30254,0.22755,1.10033,-0.07529,0.57090,-0.16540,1.03426,0.35784,0.86339,0.48984,0.30386,1.03112,0.85447,-0.14489,0.94230,0.16595,0.62402,0.89707,0.89997,0.67482,0.94689,-0.15470,0.84669,-0.01977,1.01983,1.16349,0.57535,0.22572,0.96662,0.67065,0.85948,0.14422,1.08453,0.66700,1.10698,0.78104,0.43619,0.86961,1.09352,0.04476,0.30088,0.57994,0.66895,1.16758,1.10447,0.35337,1.08573,0.06695,0.52222,0.57066,0.94878,0.52213,0.41045,1.27125,0.71610,0.15418,1.00855,0.44144,0.87952,0.34948,0.78344,0.47896,0.73693,0.49912,0.81318,0.19542,0.72246,0.11180,0.85803,0.87945,0.72191,-0.16239,0.29921,1.04491,0.99273,0.32611,0.45865,-0.06275,0.65207,0.03162,0.69912,1.27331,0.31802,0.29487,0.30125,0.82026,0.90048,-0.00802,0.53465,0.30443,0.95098,0.71562,0.65216,-0.00048,0.94799,0.69074,1.03472,-0.08042,0.29795]);   // where each point sits in the eyes
  var HOME = new Float32Array([0.21085,0.69597,0.14499,0.50501,0.30961,0.32859,0.35546,0.38041,0.30872,0.52223,0.23867,0.32868,0.30134,0.45763,0.23920,0.47401,0.25851,0.56361,0.38250,0.31700,0.52779,0.53060,0.42159,0.46449,0.45389,0.64764,0.35817,0.43595,0.56187,0.46575,0.52092,0.65044,0.37108,0.50290,0.46552,0.58837,0.42960,0.74553,0.49523,0.40718,0.27952,0.72645,0.31779,0.59735,0.37749,0.56686,0.39447,0.80542,0.32977,0.67082,0.35357,0.73888,0.40495,0.68988,0.49019,0.71223,0.26410,0.64542,0.22636,0.77715,0.17274,0.44606,0.13797,0.57830,0.66666,0.85765,0.59836,0.56510,0.56864,0.69825,0.66155,0.50332,0.94305,0.62379,0.75045,0.26516,0.66481,0.56816,0.72488,0.63771,0.84219,0.45881,0.88512,0.40603,0.79912,0.59423,0.81612,0.38852,0.92590,0.46830,0.86481,0.52196,0.90107,0.77266,0.87657,0.58837,0.77842,0.67475,0.79477,0.52105,0.90276,0.69262,0.76213,0.75290,0.70390,0.70773,0.63885,0.68921,0.67909,0.39708,0.66075,0.63028,0.07416,0.52934,0.12605,0.38830,0.20213,0.61467,0.20282,0.53600,0.38794,0.62536,0.21037,0.39318,0.43287,0.54536,0.28099,0.39614,0.54754,0.76319,0.42629,0.35982,0.43281,0.41194,0.56110,0.40307,0.62799,0.43566,0.53122,0.58928,0.55142,0.32268,0.59238,0.62944,0.71636,0.32216,0.70463,0.45193,0.72850,0.51486,0.65902,0.34422,0.73325,0.57652,0.77181,0.44949,0.60268,0.36393,0.74469,0.38310,0.84641,0.64989,0.86923,0.33271,0.99308,0.42616,1.00641,0.57095,0.83439,0.72722,0.94682,0.31599,1.00815,0.49695,1.07135,0.44022,0.50156,0.46057,0.60260,0.50683,0.52284,1.13083,0.04203,0.39967,0.27117,0.98569,1.06496,0.78239,0.32972,1.04654,1.29173,0.77352,0.42479,0.93140,0.88486,0.85263,0.47707,0.78970,0.76361,1.08086,-0.15483,0.34773,0.57563,0.26516,0.09163,0.96746,0.64300,0.93329,0.46223,1.07227,1.10513,0.63351,0.52763,0.83768,0.62406,0.28989,-0.12309,1.00102,0.05420,0.88839,-0.13002,0.84563,-0.00508,0.33962,1.14689,0.76118,-0.05825,0.77368,1.23062,0.45401,1.02004,0.35045,1.00998,0.84423,1.26872,1.00473,-0.19826,0.42055,1.01484,1.07781,1.23774,0.90880,0.16325,0.82298,0.90127,0.26516,0.34904,0.26516,0.11671,0.26516,1.15363,0.91594,1.05849,0.70604,1.14263,0.48425,0.01884,0.81420,1.17473,0.68033,0.46477,0.31062,-0.04618,0.85641,0.68795,0.78293,0.01135,0.47480,0.08956,0.78319,0.01613,0.73447,-0.04277,1.03215,0.58488,0.88636,1.07226,1.14038,1.06572,0.28076,0.26703,0.84068,1.09530,0.85708,-0.12632,0.56524,0.13044,1.04380,1.02422,0.63809,0.69845,0.98630,0.00820,0.56168,-0.12621,0.46483,1.30696,0.85869,0.77843,0.98687,0.46714,0.50473,0.56191,0.96251,0.39028,1.11833,0.85147,1.02607,0.85993,0.93398,0.67646,0.26516,0.31830,0.79888,0.09128,0.45457,-0.08317,0.92757,1.14537,0.28598,1.27333,0.52759,1.22127,0.31978,0.98080,0.77388,1.17472,0.39200,-0.11104,1.08647,1.08155,0.54219,0.82635,0.26516,0.79126,0.32463,-0.04917,0.41389,1.09304,0.97574,0.16198,0.32805,0.07761,0.32892,1.09968,0.35978,1.24287,0.60836,1.09962,1.05938,0.82290,0.80346,-0.05497,0.69135,1.03349,0.91858,0.48378,0.98910,0.60465,1.10297,0.42602,0.26516,-0.05638,0.60634,-0.19591,0.51849,0.14289,0.65815,0.94238,0.37926,0.95761,1.14038,1.30696,0.39976,0.74544,0.83119,0.21242,0.89160,0.94939,0.90085,0.99022,0.26516,0.21333,1.13007,-0.12680,0.65308,-0.19221,1.05461,0.36203,0.87359,0.50579,0.26516,1.19016,0.83569,-0.19826,0.95983,0.15297,0.74090,0.92376,0.98003,0.61897,1.01387,-0.19826,0.79399,0.04341,1.03948,1.16412,0.57144,0.18480,0.96846,0.72703,0.91127,0.12717,1.14038,0.68182,1.14038,0.93849,0.54197,0.92914,1.06224,0.02998,0.26516,0.62599,0.75105,1.15818,1.12250,0.30404,1.12781,0.07507,0.61220,0.54244,1.04637,0.50400,0.35226,1.25914,0.69354,0.21799,1.04658,0.35044,0.95786,0.29108,0.91006,0.44597,0.85810,0.50422,0.91012,0.08225,0.69776,0.13448,0.89769,0.97538,0.69877,-0.18032,0.26516,1.00477,0.99565,0.27577,0.26516,-0.19826,0.61044,0.01297,0.65008,1.30606,0.31242,0.19875,0.26516,0.80392,0.88219,-0.05942,0.51443,0.40604,1.01380,0.60443,0.81503,-0.00008,0.95289,0.68122,1.06295,-0.07936,0.31239]);   // where it sits when there are none
  var ST_IN = new Float32Array([0.3854,0.3136,0.3177,0.3593,0.1597,0.1965,0.1036,0.1370,0.2294,0.1304,0.0296,0.0306,0.0000,0.0523,0.0363,0.0740,0.0036,0.0000,0.1022,0.0312,0.0561,0.1351,0.1241,0.2086,0.3583,0.2160,0.2882,0.3469,0.4180,0.3914,0.3954,0.4826,0.0529,0.0597,0.1223,0.0000,0.0748,0.0785,0.0991,0.2370,0.3162,0.1915,0.3804,0.3924,0.4421,0.4630,0.3633,0.4107,0.2908,0.3929,0.2814,0.2016,0.2035,0.0962,0.0000,0.0554,0.3981,0.5337,0.3313,0.3784,0.4204,0.4070,0.3131,0.2607,0.0718,0.1307,0.1421,0.0669,0.0000,0.1350,0.0000,0.0537,0.0246,0.1437,0.1877,0.2122,0.2389,0.1439,0.2075,0.3076,0.2842,0.3800,0.3861,0.4553,0.3762,0.4711,0.4673,0.4129,0.1207,0.1659,0.7670,0.6404,0.5454,0.5505,0.6664,0.8741,0.4133,0.5090,0.2092,0.7844,0.9495,0.1689,0.8063,0.4059,0.6890,0.5946,0.2547,0.2700,0.8965,0.7222,0.9501,0.6919,0.8658,0.9787,0.9263,0.6351,0.6214,0.9729,0.9424,0.8298,0.9577,0.5334,0.6105,0.4223,0.5362,0.9113,0.5995,0.6461,0.5484,0.8961,0.3251,0.8231,0.2463,0.8677,0.6317,0.8269,0.9918,0.4099,0.9804,0.6750,0.3936,0.8828,1.0000,0.7912,0.5701,0.7180,0.6156,0.9157,1.0000,0.6496,0.0000,0.5719,0.5723,0.7427,0.6289,0.5071,0.5129,0.6380,0.9375,0.7169,0.9032,0.9425,0.5255,0.9312,0.8911,0.5809,0.4992,0.1877,0.7392,0.9933,0.5068,0.7079,0.8239,0.9347,1.0000,0.5032,0.8546,0.8497,0.5492,0.7196,0.1773,0.7115,0.8759,0.4975,0.5428,0.8566,0.9958,0.5140,0.5958,0.6320,0.5948,0.8665,0.8462,1.0000,0.5207,0.4707,0.8414,0.9784,0.6592,0.6204,0.5327,0.9208,0.9296,0.7034,0.6328,0.5691,0.9434,0.7693,0.3783,0.8205,0.8389,0.1576,1.0000,0.8342,0.6877,0.5059,0.1601,0.8514,0.8748,0.4472,0.4646,0.2453,0.4186,0.5176,0.7454,0.5588,0.9794,0.8482,0.3904,0.7356,0.7491,1.0000,0.6433,0.7066,0.8097,0.5694,0.1414,0.9497,0.5970,0.8628]);  // its place in the arrival queue
  var ST_OUT = new Float32Array([0.5045,0.4840,0.4163,0.2786,0.3754,0.3905,0.2883,0.4199,0.4708,0.2753,0.3187,0.4063,0.3813,0.4330,0.5543,0.4753,0.4474,0.6047,0.5189,0.5343,0.5740,0.5443,0.4469,0.5019,0.4307,0.6548,0.4215,0.5848,0.4526,0.5530,0.4479,0.4699,0.4098,0.4719,0.4402,0.3318,0.3843,0.2235,0.2772,0.3051,0.3556,0.2104,0.3340,0.3157,0.3977,0.4222,0.4434,0.5093,0.4205,0.6487,0.5185,0.6275,0.5820,0.5627,0.4661,0.4142,0.2858,0.2956,0.2482,0.2818,0.2269,0.2189,0.3484,0.1808,0.3503,0.2832,0.1780,0.2646,0.1545,0.2451,0.3116,0.2378,0.1653,0.0990,0.2585,0.2634,0.2896,0.1616,0.2655,0.1096,0.2264,0.1992,0.3040,0.2562,0.2776,0.2280,0.2225,0.2896,0.4021,0.4495,0.9405,0.0520,0.7896,0.7805,1.0000,0.6394,0.7757,0.6495,0.6832,0.8535,0.0000,0.1418,0.9062,0.8459,0.9411,0.5298,0.8061,0.0400,0.8703,0.7768,0.7388,0.0373,0.7030,0.7572,0.2473,0.1269,0.6542,0.9301,0.1315,0.8338,0.8004,0.7120,0.0000,0.0245,0.1320,0.9068,0.4924,0.4800,0.6771,0.6375,0.0536,0.6952,0.5656,0.2109,0.5882,0.6009,0.9321,0.7594,0.9492,0.0186,0.5919,0.8334,0.4755,0.8967,0.4377,0.9888,0.4215,0.3848,0.8169,0.9006,0.6375,0.8813,0.8563,0.9450,0.7593,0.0165,0.5208,0.1805,0.7521,0.0860,0.2385,0.0000,0.6156,0.1856,0.9927,0.1722,0.0318,0.2007,0.1226,0.8778,0.1179,0.0000,0.1499,0.4800,0.8290,0.5412,0.6200,0.7797,0.8284,1.0000,0.0778,0.6889,0.7344,0.4957,0.1065,1.0000,0.1329,0.7361,0.8071,0.7907,0.1012,1.0000,0.4955,0.8524,0.8752,0.0675,0.7533,0.9233,0.5630,0.7732,0.8830,0.7286,0.9662,0.4176,0.8813,0.7895,1.0000,0.9686,0.1902,0.9758,0.0594,0.5955,1.0000,1.0000,0.4047,0.8782,0.0069,0.5935,0.9285,0.7396,0.8093,0.6964,0.7634,0.6849,0.7979,0.5786,0.0000,0.9252,0.0533,0.5331,0.5838,0.0000,0.0000,0.7482,0.3208,0.8192,0.6600,0.8314,0.8723,0.0342]);// and in the departure queue

  function hash(i, k) {
    var x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  var PH1 = new Float32Array(N), PH2 = new Float32Array(N);
  var W1 = new Float32Array(N), W2 = new Float32Array(N), ARCS = new Float32Array(N);
  for (var i = 0; i < N; i++) {
    PH1[i] = hash(i, 1) * 6.2832;
    PH2[i] = hash(i, 2) * 6.2832;
    W1[i] = DRIFT_SPEED * (0.7 + 0.6 * hash(i, 3));
    W2[i] = DRIFT_SPEED * (0.7 + 0.6 * hash(i, 4));
    ARCS[i] = hash(i, 7) * 2 - 1;
  }

  var VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";

  // Two points per vec4, because a uniform array of vec4 is the widest thing
  // WebGL1 guarantees. PAIRS vec4s stays well inside the 224 every
  // implementation must support.
  var PAIRS = 120;
  var FRAG = [
    // WebGL1 does not guarantee high precision in fragment shaders, so fall
    // back to medium where high is absent. Everything below is in NORMALISED
    // field units (the viewport is 1.0 wide), which keeps squared distances
    // around 1 instead of the hundreds of thousands raw units would give.
    // Medium precision tops out near 65504, so raw units would overflow and
    // the field would break on older mobile GPUs.
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "precision highp float;",
    "#else",
    "precision mediump float;",
    "#endif",
    "uniform vec2 iResolution;",
    "uniform vec4 uPts[" + PAIRS + "];",
    "uniform vec4 uWin;",   // field x0, eye y, window width, anchor
    "uniform vec4 uDom;",   // seeded domain x0, x1, y0, y1
    "uniform vec3 uBg;",
    "uniform vec3 uInk;",
    "uniform float uAmt;",
    "uniform float uWall;",
    "",
    "float ss(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}",
    "",
    "void main(){",
    "  float scale = iResolution.x / uWin.z;",
    "  float yTop = iResolution.y - gl_FragCoord.y;",
    "  vec2 f = vec2(uWin.x + gl_FragCoord.x / scale,",
    "                uWin.y + (yTop - uWin.w * iResolution.y) / scale);",
    "",
    "  // the two nearest points, and where they are",
    "  float d1 = 1e3, d2 = 1e3;",
    "  vec2 q1 = vec2(0.), q2 = vec2(0.);",
    "  for (int k = 0; k < " + PAIRS + "; k++) {",
    "    vec4 pp = uPts[k];",
    "    for (int h = 0; h < 2; h++) {",
    "      vec2 p = (h == 0) ? pp.xy : pp.zw;",
    "      vec2 v = f - p;",
    "      float d = dot(v, v);",
    "      if (d < d1)      { d2 = d1; q2 = q1; d1 = d; q1 = p; }",
    "      else if (d < d2) { d2 = d;  q2 = p; }",
    "    }",
    "  }",
    "",
    "  // Exact distance to the wall. For two points the wall is their",
    "  // perpendicular bisector, so this is (d2-d1)/(2*separation) with the",
    "  // distances still squared. No square roots, and if two points ever land",
    "  // on top of each other the separation goes to zero and nothing is drawn,",
    "  // instead of flooding a black blob.",
    "  float sep = length(q1 - q2);",
    "  float sd = (d2 - d1) / max(2.0 * sep, 1e-6) * scale;",
    "  float wall = 1.0 - ss(0.4 * uWall, 1.1 * uWall, sd);",
    "",
    "  float uvy = (2.0 * gl_FragCoord.y - iResolution.y) / iResolution.y;",
    "  float fade = ss(-0.2, 1.1, uvy);",           // strongest up top, as before
    "  float mx = 0.12 * (uDom.y - uDom.x), my = 0.12 * (uDom.w - uDom.z);",
    "  float edge = ss(0.0, 1.0, min(min((f.x-uDom.x)/mx, (uDom.y-f.x)/mx),",
    "                               min((f.y-uDom.z)/my, (uDom.w-f.y)/my)));",
    "",
    "  vec3 col = mix(uBg, uInk, wall * fade * edge * uAmt);",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
    return s;
  }
  var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.remove(); return; }
  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(prog, "iResolution");
  var uPts = gl.getUniformLocation(prog, "uPts");
  var uWin = gl.getUniformLocation(prog, "uWin");
  var uDom = gl.getUniformLocation(prog, "uDom");
  var uBg = gl.getUniformLocation(prog, "uBg");
  var uInk = gl.getUniformLocation(prog, "uInk");
  var uAmt = gl.getUniformLocation(prog, "uAmt");
  var uWall = gl.getUniformLocation(prog, "uWall");

  gl.uniform4f(uWin, 0.55435 - 1.0 / 2.0, 0.55652, 1.0, 0.240);
  gl.uniform4f(uDom, -0.16565, 1.27435, 0.29777, 1.10777);
  gl.uniform1f(uWall, WALL_PX);

  function applyTheme() {
    if (darkScheme.matches) {
      gl.uniform3f(uBg, 0.110, 0.102, 0.094);   // #1c1a18
      gl.uniform3f(uInk, 0.910, 0.894, 0.871);  // #e8e4de
      gl.uniform1f(uAmt, AMT_DARK);
    } else {
      gl.uniform3f(uBg, 0.980, 0.976, 0.969);   // #faf9f7
      gl.uniform3f(uInk, 0.165, 0.153, 0.137);  // #2a2723
      gl.uniform1f(uAmt, AMT_LIGHT);
    }
  }
  applyTheme();

  var scaleSteps = [0.40, 0.32, 0.25];   // dropped a step if frames run long
  var scaleIdx = 0;
  function resize() {
    var s = scaleSteps[scaleIdx];
    canvas.width = Math.max(1, Math.floor(innerWidth * s));
    canvas.height = Math.max(1, Math.floor(innerHeight * s));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  }
  resize();

  // ---- where every point is, right now ----------------------------------
  var pts = new Float32Array(PAIRS * 4);
  function ss01(x) { x = x < 0 ? 0 : (x > 1 ? 1 : x); return x * x * (3 - 2 * x); }

  function place(t) {
    var per = GROW + MELT;
    var tc = t - Math.floor(t / per) * per;
    var uIn = Math.min(1, Math.max(0, tc / GROW));
    var uOut = Math.min(1, Math.max(0, (tc - GROW) / MELT));
    for (var i = 0; i < N; i++) {
      var a = ss01((uIn - ST_IN[i] * (1 - TRAVEL_IN)) / TRAVEL_IN);
      var r = ss01((uOut - ST_OUT[i] * (1 - TRAVEL_OUT)) / TRAVEL_OUT);
      var l = a * (1 - r);
      var hx = HOME[i*2], hy = HOME[i*2+1], fx = FACE[i*2], fy = FACE[i*2+1];
      var px = hx + (fx - hx) * l, py = hy + (fy - hy) * l;
      var vx = fx - hx, vy = fy - hy, vl = Math.sqrt(vx*vx + vy*vy);
      if (vl > 1e-4) {
        var bow = ARC * ARCS[i] * Math.sin(Math.PI * l);
        px += (-vy / vl) * bow; py += (vx / vl) * bow;
      }
      var da = DRIFT * (1 - l);
      pts[i*2]     = px + da * Math.sin(t * W1[i] + PH1[i]);
      pts[i*2 + 1] = py + da * Math.cos(t * W2[i] + PH2[i]);
    }
    gl.uniform4fv(uPts, pts);
  }

  function draw(t) {
    place(t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  addEventListener("resize", function () { resize(); draw(shown); });
  darkScheme.addEventListener("change", function () { applyTheme(); draw(shown); });

  var start = performance.now();
  var shown = GROW;             // the still frame shows the eyes formed
  var raf = null, lastFrame = 0, slow = 0;
  var MIN_MS = 1000 / 30;       // 30fps is plenty for something this slow

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (now - lastFrame < MIN_MS) return;

    var began = performance.now();
    shown = (now - start) / 1000;
    draw(shown);
    lastFrame = now;

    // If the machine is struggling, step the resolution down. If it is still
    // struggling at the lowest step, stop animating and leave a still frame.
    if (performance.now() - began > 24) {
      if (++slow > 20) {
        slow = 0;
        if (scaleIdx < scaleSteps.length - 1) { scaleIdx++; resize(); }
        else { cancelAnimationFrame(raf); raf = null; }
      }
    } else if (slow > 0) { slow--; }
  }

  if (reduceMotion) {
    draw(shown);
  } else {
    raf = requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
      } else if (!raf) {
        lastFrame = 0;
        raf = requestAnimationFrame(loop);
      }
    });
  }
})();
