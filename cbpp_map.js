/*Reusable map code*/
/*globals module, require, window*/
module.exports = function($, d3) {
	"use strict";
	var CBPP_Map = {};
	//var Raphael = require('raphael');
	var paths = require('./app/us_paths.js');
	var mapevents_build = require('./app/mapevents.js');

	var MapColors = require('./app/mapcolors.js');
	var r_legend = require('./app/legend.js');
	var statenames = require('./app/statenames.js');
	CBPP_Map.stateNames = statenames;
	CBPP_Map.utilities = (function() {
		/*data loading functions - need to be immediately available*/
		return {
			csvParser: function(csvString) {
				var n;
				csvString = csvString.split("\r\n");
				for (var i = 0, ii = csvString.length; i<ii; i++) {
					csvString[i] = csvString[i].split(",");
					for (var j = 0, jj = csvString[i].length; j<jj; j++) {
						if (csvString[i][j].length === 0) {
							csvString[i][j] = null;
						} else {
							n = csvString[i][j]*1;
							if (!isNaN(n)) {
								csvString[i][j] = n;
							}
						}
					}
				}
				return csvString;
			},
			dataOrganizer: function(arr) {
				var rObj = {}, key;
				for (var i = 0,ii=arr.length;i<ii;i++) {
					key = "keys";
					if (arr[i][0]!==null || i !== 0) {
						key = arr[i][0];
					}
					if (key!==null) {
						rObj[key] = [];
						for (var j = 1,jj = arr[i].length;j<jj;j++) {
							if (arr[i][j] !== null ) {
								rObj[key].push(arr[i][j]);
							}
						}
					}
				}
				return rObj;
			},
			formats: {
				/*from http://stackoverflow.com/questions/3883342/add-commas-to-a-number-in-jquery*/
				commaSeparateNumber: function (val) {
					while (/(\d+)(\d{3})/.test(val.toString())) {
						val = val.toString().replace(/(\d+)(\d{3})/, '$1' + ',' + '$2');
					}
					return val;
				},
				dollarFormat : function (n, ops) {
					var usePlus = false, roundTo = 0;
					if (typeof (ops) !== "undefined") {
						if (typeof (ops.usePlus) !== "undefined") {
							usePlus = ops.usePlus;
						}
						if (typeof (ops.roundTo) !== "undefined") {
							roundTo = ops.roundTo;
						}
					}
					var rounding = Math.pow(10, roundTo);
					return (n < 0 ? "-" : (usePlus ? "+" : "")) + "$" + this.utilities.commaSeparateNumber(Math.abs(Math.round(n * rounding) / rounding));
				},

				percentFormat : function (n, ops) {
					var usePlus = false, roundTo = 0;
					if (typeof (ops) !== "undefined") {
						if (typeof (ops.usePlus) !== "undefined") {
							usePlus = ops.usePlus;
						}
						if (typeof (ops.roundTo) !== "undefined") {
							roundTo = ops.roundTo;
						}
					}
					var rounding = Math.pow(10, roundTo);
					return (n < 0 ? "-" : (usePlus ? "+" : "")) + (Math.round(Math.abs(Math.round(n * 10000) / 100) * rounding) / rounding) + "%";
				}
			}
		};
	})();

	require('./cbpp_map.css');

	/*import functionality from other files*/
	var legend = new r_legend($, d3);
	//create the main map object
	CBPP_Map.Map = function (id, ops) {
		var m = this; //store a short reference to main object for easy use
		m.mapSelector = id;
		var mapEvents;
		$(m.mapSelector).addClass("cbpp_map");
		/*defaults*/
		var defaultOptions = {
			stateClick: function() {
				return false;
			},
			zoomOutStart: function () {
				return false;
			},
			fullScaleWidth: 580,
			labelsToHide: function () {
				return false;
			},
			labelFontSize: 28,
			data: {},
			dataIndex:0,
			disabledHoverStates: {},
			colorConfig: {
				highColor:"#ffffff",
				lowColor:"#000000",
				borderColor:"#eeeeee",
			},
			hidePR: true,
			hideGU: true,
			hideVI: true,
			borderWidth: 0.5,
			labelDarkColor: "#666",
			labelLightColor: "#fff",
			legendLabelSize:24,
			disableAllPopups: false,
			brightnessThreshold: 550,
			popupTemplate: function(data, s) {
				if (typeof(data)!=="undefined") {
					if (typeof(data[s])!=="undefined") {
						return data[s][m.dataIndex];
					}
				}
				return "";
			},
			/*the paths are based on a coordinate system 940 pixels wide - this gets used in various places, so
			define it as a constant here*/
			viewX: 940,
			viewY: 627

		};

		/*load defaults*/
		$.extend(true, m, defaultOptions);

		/*load user ops*/
		$.extend(true, m, ops);

		if (m.hideUS) {
			delete paths.states.US;
			delete paths.text.US;
		}

		if (m.hidePR) {
			delete paths.states.PR;
			delete paths.text.PR;
		}

		if (m.hideGU) {
			delete paths.states.GU;
			delete paths.text.GU;
		}

		if (m.hideVI) {
			delete paths.states.VI;
			delete paths.text.VI;
		}



		//get width and height of the parent div (given in ops)
		m.width = $(m.mapSelector).width();
		m.height = $(m.mapSelector).height();
		//m.height = m.width * (370 / 525);
		$(m.mapSelector).height();
		m.fontFamily = $(m.mapSelector).css("font-family");

		/*create the main Raphael canvas*/
		$(m.mapSelector).html("");
		//m.paper = new Raphael($(m.mapSelector)[0], m.width, m.height);

		/*scale the canvas to accomodate the path coordinate system*/
		var top = 0;
		if (m.legendLocation === "top") {
			top = -50;
		}
		m.paper = d3.select(m.mapSelector).append("svg")
			.attr("width",m.width)
			.attr("height",m.height)
			.attr("viewBox", "0 " + top + " " + m.viewX + " " + m.viewY)
			.attr("preserveAspectRatio","xMinYMin");


		//m.paper.setViewBox(0, top, m.viewX, m.viewY);
		m.scaleFactor = m.width / m.viewX;

		/*Group together a handful of utility functions used frequently*/
		this.utilities = {

			/*get the center of a path*/
			pathCenter: function (p) {
				var box, x, y, c = 1;
				box = p.node().getBBox();
				x = Math.floor(box.x / c + box.width / c / 2.0);
				y = Math.floor(box.y / c + box.height / c / 2.0);
				return [x, y];
			},

			/*get the correct coordinates of a text path, based on configuration options
			in the paths file*/
			getTextCoords: function (state) {
				var coords = m.utilities.pathCenter(m.stateObjs[state]),
					text_configs = paths.text;
				if (text_configs.offset[state]) {
					coords[0] += text_configs.offset[state][0];
					coords[1] += text_configs.offset[state][1];
				}
				if (text_configs.absOffset[state]) {
					coords[0] = text_configs.absOffset[state][0];
					coords[1] = text_configs.absOffset[state][1];
				}
				return coords;
			},

			/*add commas to a number*/
			commaSeparateNumber: CBPP_Map.utilities.formats.commaSeparateNumber
		};


		$(window).on("resize", function() {
			if ($(m.mapSelector).width()===0) {
				return;
			}
			var svg = $(m.mapSelector + " svg"),
			aspectRatio = svg.height()/svg.width();
			var containerWidth = $(m.mapSelector).width();
			m.paper.attr("width", containerWidth);
			m.paper.attr("height", containerWidth*aspectRatio);
			//m.paper.setSize(svg.width(), svg.height());
			//m.fixLineWeights();
			m.fixLegend();
		});

		this.fixLineWeights = function() {
			var lineWeight = m.borderWidth * 940 / $(m.mapSelector).width();
			for (var state in m.stateObjs) {
				if (m.stateObjs.hasOwnProperty(state)) {
					m.stateObjs[state].attr("stroke-width",lineWeight);
				}
			}
		};

		this.fixLegend = function() {
			/*the CBPP main stylesheet makes this nonsense necessary*/
			$(m.mapSelector + " svg rect").css("cssText", 'width: ' + $(m.mapSelector + " svg rect").attr("width") + "px !important");
		};

		this.redraw = function (dur, callback) {
			if (typeof (dur) === "undefined") {
				dur = 100;
			}
			//recalculate the max and min based on the new dataset
			this.colors.calculateMinMax();
			//recalculate the map colors based on new data and new max/min
			this.colors.calcStateColors();
			//redraw the map (animate over 100 ms)
			this.colors.applyStateColors(dur, function() {
				if (typeof(callback) === "function") {
					callback();
				}
			});
			this.makeLegend();
		};

		/*Draw the basic map. This has to be run by the user module before using the color functions,
		because those depend on the paths already existing*/
		this.drawPaths = function (doneDrawingPaths) {
			//graph the paths from the paths module

			var us_paths = paths.states, state;

			//draw one state
			function makeState(state) {

				//get the path
				var pathString = us_paths[state].path;

				/*if the stateObjs object doesn't exist yet (if this is the first state we've
				drawn), make it*/
				if (typeof (m.stateObjs) === "undefined") { m.stateObjs = {}; }

				//create the Raphael object for the state and give it its starting attributes
				m.stateObjs[state] = m.paper.append("path")
					.attr("d", pathString)
					.attr("cursor", "pointer")
					.attr("fill", "#fff");
					/*"stroke-width": m.scaleFactor*/

				m.stateObjs[state].attr("id","statePath_" + state);

				//store raphael IDs of each state
				/*if (typeof (m.stateIDs) === "undefined") { m.stateIDs = {}; }
				m.stateIDs[state] = m.stateObjs[state].node.raphaelid;

				//and for reverse lookup
				if (typeof (m.stateCodes) === "undefined") { m.stateCodes = {}; }
				m.stateCodes[m.stateObjs[state].node.raphaelid] = state;*/
			}

			//draw a state label
			function makeText(state) {

				//get the coordinates based on configuration on paths file
				var coords = m.utilities.getTextCoords(state);

				//make the Raphael object for the text object
				if (typeof (m.stateLabelObjs) === "undefined") { m.stateLabelObjs = {}; }
				m.stateLabelObjs[state] = m.paper.append("text")
					.text(state)
					.attr("x", coords[0])
					.attr("y", coords[1])
					.attr("font-size", m.labelFontSize)
					.attr("font-family", m.fontFamily)
					.attr("font-weight",300)
					.attr("text-anchor","middle")
					.attr("dy",m.labelFontSize/3);

				m.stateLabelObjs[state].attr("id","stateText_" + state);

				if (typeof (m.labelsToHide) !== "undefined") {
					if (typeof (m.labelsToHide[state]) !== "undefined") {
						if (m.labelsToHide[state] === 1) {
							m.stateLabelObjs[state].attr("opacity", 0);
						}
					}
				}
			}

			var statesArr = [];

			//loop through all the states and draw them and their label
			for (state in us_paths) {
				if (us_paths.hasOwnProperty(state)) {
					if (!(m.hideDC === true && state === "DC")) {
						statesArr.push(state);
					}
				}
			}
			statesArr.sort(function() {
				return Math.random() - 0.5;
			});

			var stateIndex = 0;
			var doStateAndWait = function() {
				state = statesArr[stateIndex];
				makeState(state);
				if (!paths.text.hide[state]) {
					makeText(state);
				}
				stateIndex++;
				if (stateIndex < statesArr.length) {
					if (stateIndex%5 === 0) {
						setTimeout(function() {
							doStateAndWait();
						},0);
					} else {
						doStateAndWait();
					}
				} else {
					finish();
				}
			};
			doStateAndWait();

			function finish() {
				if (m.hideUSBox === true) {
					if (typeof (m.stateObjs.US) !== "undefined") {
						m.stateObjs.US.attr("opacity",0).attr("stroke-width",0.1);
					}
				}

				//draw the lines pointing from the labels to the smaller states
				function makeLines(map_lines) {
					var i, ii, state;
					function makeLine(lineNumber, state) {
						var line = map_lines[state][lineNumber];
						if (typeof (m.maplines[state]) === "undefined") {
							m.maplines[state] = [];
						}
						m.maplines[state][lineNumber] = m.paper.append("path")
							.attr("d", "M" + line[0] + " " + line[1] + " L" + line[2] +" "+ line[3])
							.attr("stroke-width",2)
							.attr("stroke","#888888")
							.attr("fill","#888888");
					}
					m.maplines = {};
					for (state in map_lines) {
						if (map_lines.hasOwnProperty(state)) {
							for (i = 0, ii = map_lines[state].length; i < ii; i += 1) {
								makeLine(i, state);
								if (typeof (m.labelsToHide) !== "undefined") {
									if (m.labelsToHide[state] === 1) {
										m.maplines[state][i].attr("opacity", 0);
									}
								}
							}
						}
					}
				}
				makeLines(paths.lines);
				//assign event handlers to the map and its objects - this is done in the events module
				mapEvents = mapevents_build(m, $, d3);
				doneDrawingPaths();
			}
		};

		this.afterPathsDrawn = function() {
			m.colors = new MapColors(m.colorConfig, m, m.customMax, m.customMin);
			m.colors.calcStateColors();
			m.colors.applyStateColors();
			m.setNewOptions = function(o) {
				$.extend(true, m, o);
			};
			m.clearOptions = function(l) {
				for (var i = 0, ii = l.length; i<ii; i++) {
					delete m[l[i]];
				}
			};
			m.makeLegend = function () {
				if (typeof (m.zoomedState) === "string") {
					return false;
				}
				m.legendMaker = legend;
				m.legendMaker.setBounds(m.min, m.max);
				m.legendMaker.defineColors(m.colors.colorConfig.lowColor, m.colors.colorConfig.highColor,m.colors.colorConfig.zeroColor);
				if (m.legendFormatter) {
					m.legendMaker.setFormatter(m.legendFormatter);
				}
				if (m.hideLegend !== true) {
					m.legendMaker.draw(this);
				}
				m.fixLegend();
			};


			m.makeLegend();

			/*initialize list of hidden states - all visible at first*/
			m.hiddenStates = (function () {
				var returnObj = {}, state;
				for (state in m.stateObjs) {
					if (m.stateObjs.hasOwnProperty(state)) {
						returnObj[state] = false;
					}
				}
				return returnObj;
			})();

			m.fadeInAnimations = {};
			m.fadeOutAnimations = {};
			m.lineAnimations = {};
			m.labelFadeInAnimations = {};
			m.labelFadeOutAnimations = {};

			m.showStates = function (stateList, duration) {
				var state, m = this, cb = function () {
					var state = m.stateCodes[m.id];
					m.hiddenStates[state] = false;
				};
				for (var i = 0, ii = stateList.length; i < ii; i++) {
					state = stateList[i];
					if (m.hiddenStates[state] === true) {
						m.stateObjs[state].show();
						m.stateLabelObjs[state].show();
						m.fadeInAnimations[state] = m.stateObjs[state].transition()
							.style("opacity",1)
							.duration(duration)
							.on("end",cb);
						m.labelFadeInAnimations[state] = m.stateLabelObjs[state].transition()
							.style("opacity",1)
							.duration(duration);
						if (typeof (m.maplines[state]) !== "undefined") {
							if (typeof (m.lineAnimations[state]) === "undefined") {
								m.lineAnimations[state] = [];
							}
							for (var j = 0, jj = m.maplines[state].length; j < jj; j++) {
								m.lineAnimations[state][j] = m.maplines[state][j].transition()
									.style("opacity",1)
									.duration(duration);
							}
						}
					}

				}
			};

			m.hideStates = function (stateList, duration) {
				var state, m = this, cb = function () {
					var state = m.stateCodes[m.id];
					m.hiddenStates[state] = true;
					m.stateObjs[state].hide();
					m.stateLabelObjs[state].hide();
				};
				for (var i = 0, ii = stateList.length; i < ii; i++) {
					state = stateList[i];
					if (m.hiddenStates[state] === false) {
						m.fadeOutAnimations[state] = m.stateObjs[state].transition()
							.style("opacity",0.01)
							.duration(duration)
							.on("end",cb);
						m.labelFadeOutAnimations[state] = m.stateLabelObjs[state].transition()
							.style("opacity",0)
							.duration(duration);
						if (typeof (m.maplines[state]) !== "undefined") {
							if (typeof (m.lineAnimations[state]) === "undefined") {
								m.lineAnimations[state] = [];
							}
							for (var j = 0, jj = m.maplines[state].length; j < jj; j++) {
								m.lineAnimations[state][j] = m.maplines[state][j].transition()
									.style("opacity", 0)
									.duration(duration);
							}
						}
					}

				}
			};
			if (typeof(m.finished)==="function") {
				m.finished();
			}
		};
		this.drawPaths(this.afterPathsDrawn);


	};


	return CBPP_Map;

};
