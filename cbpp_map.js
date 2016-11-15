/*Reusable map code*/
/*globals Raphael, Typekit, CBPP*/

(function() {
	"use strict";
	if (typeof(CBPP.Map) !== "undefined") {
		return;
	}
	CBPP.Map = {};
	CBPP.Map.utilities = (function() {
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

	CBPP.Map.load = function (callback) {
		var required_scripts = ["app/us_paths.js", "app/mapevents.js", "app/mapcolors.js", "app/legend.js", "app/statenames.js","app/raphael.min.js"];
		var scripts_requested = 0;
		var allScriptsLoaded = false;
		var load_function = function () {
			scripts_requested--;
			if (scripts_requested === 0) {
				allScriptsLoaded = true;
				ready();
			}
		};
		var urlRoot = CBPP.urlBase + "CBPP_Map/v" + CBPP.Map.version + "/";
		if (urlRoot === null) {
			urlRoot = "";
		}
		
		for (var i = 0, ii = required_scripts.length; i < ii; i++) {
			$.getScript(urlRoot + required_scripts[i], load_function);
			scripts_requested++;
		}
		var cssLoaded = false;
		var mapIsBuilt = false;
		
		var l = document.createElement("link");
		l.type="text/css";
		l.href= urlRoot + "cbpp_map.css";
		l.rel = "stylesheet";
		document.getElementsByTagName("head")[0].appendChild(l);
		
		
		function cssLoad() {
			cssLoaded = true;
			ready();
		}
		
		l.onload = cssLoad;
		l.load = cssLoad;
		
		function ready() {
			if (cssLoaded && allScriptsLoaded && !mapIsBuilt) {
				mapIsBuilt = true;
				afterScriptsLoaded();
			}
		}
		
		/*fallback for browsers that lack onload event*/
		setTimeout(function() {
			cssLoad();
		},1000);

		function afterScriptsLoaded() {
			/*import functionality from other files*/
			var paths = CBPP.Map.us_paths;
			var mapEvents = CBPP.Map.mapevents;
			var MapColors = CBPP.Map.mapcolors;
			var legend = new CBPP.Map.legend();
			
			//create the main map object
			CBPP.Map.Map = function (id, ops) {
				var m = this; //store a short reference to main object for easy use
				m.mapSelector = id;
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
					
					data: {},
					dataIndex:0,

					colorConfig: {
						highColor:"#ffffff",
						lowColor:"#000000",
					},
					disableAllPopups: false,
					brightnessThreshold: 200,
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
					viewY: 627,
					popupStyle: {
						padding: 10,
						fontSize: 28,
						bgColor: "#eee"
					}
					
				};

				/*load defaults*/
				$.extend(true, m, defaultOptions);
				
				/*load user ops*/
				$.extend(true, m, ops);

				if (m.hideUS) {
					delete paths.states.US;
					delete paths.text.US;
				}

				
				
				//get width and height of the parent div (given in ops)
				m.width = $(m.mapSelector).width();
				m.height = m.width * (370 / 525);
				m.fontFamily = $(m.mapSelector).css("font-family");
				
				/*create the main Raphael canvas*/
				$(m.mapSelector).html("");
				m.paper = new Raphael($(m.mapSelector)[0], m.width, m.height);
				/*scale the canvas to accomodate the path coordinate system*/
				var top = 0;
				if (m.legendLocation === "top") {
					top = -50;
				}
				m.paper.setViewBox(0, top, m.viewX, m.viewY);
				m.scaleFactor = m.width / m.viewX;


				/*The above scaling feature doesn't work quite right in IE8 (which uses VML) - below is a nasty hack fix*/
				(function () {
					/*create an element to test getBBox on*/
					var test_ie_text = m.paper.text(500, 0, "Test");

					/*this should be 1 in most browers, but IE8 doesn't work right - so if it's not 1, it'll be the 
					factor we need to correct the getBBox coordinates by and is used wherever getBBox is*/
					m.ie8_correction = Math.round(test_ie_text.getBBox().x) / 491;

					/*get rid of the testing element*/
					test_ie_text.remove();
				} ());

				/*Group together a handful of utility functions used frequently*/
				this.utilities = {

					/*get the center of a path*/
					pathCenter: function (p) {
						var box, x, y, c = m.ie8_correction;
						box = p.getBBox();
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
					commaSeparateNumber: CBPP.Map.utilities.formats.commaSeparateNumber
				};
				
				/*check if we're in IE8*/
				this.isCanvasSupported = (function(){
					var elem = document.createElement('canvas');
					return !!(elem.getContext && elem.getContext('2d'));
				})();
				
				$(window).on("resize", function() {
					var svg = $(m.mapSelector + " svg"),
					aspectRatio = svg.height()/svg.width();
					var containerWidth = $(m.mapSelector).width();
					$(m.mapSelector + " svg").attr("width", containerWidth);
					$(m.mapSelector + " svg").attr("height", containerWidth*aspectRatio);
					m.fixLegend();
				});

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
						m.stateObjs[state] = m.paper.path(pathString);
						m.stateObjs[state].attr({
							cursor: "pointer",
							fill: "#fff",
							"stroke-width": m.scaleFactor
						});

						$(m.stateObjs[state].node).attr("id","statePath_" + state);

						//store raphael IDs of each state
						if (typeof (m.stateIDs) === "undefined") { m.stateIDs = {}; }
						m.stateIDs[state] = m.stateObjs[state].node.raphaelid;

						//and for reverse lookup
						if (typeof (m.stateCodes) === "undefined") { m.stateCodes = {}; }
						m.stateCodes[m.stateObjs[state].node.raphaelid] = state;
					}

					//draw a state label
					function makeText(state) {

						//get the coordinates based on configuration on paths file
						var coords = m.utilities.getTextCoords(state);

						//make the Raphael object for the text object
						if (typeof (m.stateLabelObjs) === "undefined") { m.stateLabelObjs = {}; }
						m.stateLabelObjs[state] = m.paper.text(coords[0], coords[1], state);
						m.stateLabelObjs[state].attr({
							"font-size": 28,
							"font-family": m.fontFamily
						});

						$(m.stateLabelObjs[state].node).attr("id","stateText_" + state);

						if (typeof (m.labelsToHide) !== "undefined") {
							if (typeof (m.labelsToHide[state]) !== "undefined") {
								if (m.labelsToHide[state] === 1) {
									m.stateLabelObjs[state].attr("opacity", 0);
								}
							}
						}

						//store raphael IDs of each label
						if (typeof (m.stateTextIDs === "undefined")) { m.stateTextIDs = {}; }
						m.stateTextIDs[state] = m.stateLabelObjs[state].node.raphaelid;

						//and for reverse lookup
						if (typeof (m.stateByRaphaelTextID === "undefined")) { m.stateByRaphaelTextID = {}; }
						m.stateByRaphaelTextID[m.stateLabelObjs[state].node.raphaelid] = state;
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
								m.stateObjs.US.attr({ "opacity": 0, "stroke-width": 0.1 });
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
								m.maplines[state][lineNumber] = m.paper.path(["M", line[0], line[1], "L", line[2], line[3]]);
								m.maplines[state][lineNumber].attr({ "stroke-width": 0.5, "fill": "#888888" });
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
						mapEvents(m);
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
								m.fadeInAnimations[state] = m.stateObjs[state].animate({ opacity: 1 }, duration, "linear", cb);
								m.labelFadeInAnimations[state] = m.stateLabelObjs[state].animate({ opacity: 1 }, duration, "linear");
								if (typeof (m.maplines[state]) !== "undefined") {
									if (typeof (m.lineAnimations[state]) === "undefined") {
										m.lineAnimations[state] = [];
									}
									for (var j = 0, jj = m.maplines[state].length; j < jj; j++) {
										m.lineAnimations[state][j] = m.maplines[state][j].animate({ opacity: 1 }, duration, "linear");
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
								m.fadeOutAnimations[state] = m.stateObjs[state].animate({ opacity: 0.01 }, duration, "linear", cb);
								m.labelFadeOutAnimations[state] = m.stateLabelObjs[state].animate({ opacity: 0 }, duration, "linear");
								if (typeof (m.maplines[state]) !== "undefined") {
									if (typeof (m.lineAnimations[state]) === "undefined") {
										m.lineAnimations[state] = [];
									}
									for (var j = 0, jj = m.maplines[state].length; j < jj; j++) {
										m.lineAnimations[state][j] = m.maplines[state][j].animate({ opacity: 0 }, duration, "linear");
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
			callback();
		}
	};
})();