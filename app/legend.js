/*globals module*/
module.exports = function ($, d3) {
	"use strict";

	/*If the legend goes through zero, get the percentage horizontal position of zero*/
	function getZeroLocation(l) {
		var spansZero = (l.lowValue < 0 && l.highValue > 0), zeroPercent;
		if (spansZero) {
			zeroPercent = Math.round((-l.lowValue) / (l.highValue - l.lowValue) * 100);
			return zeroPercent;
		} else {
			return "noZero";
		}
	}

	/*Make the SVG gradient string*/
	function makeGradientData(l) {
		var gradientString,
			zeroPercent;
		var r = [];
		r.push({
			color: l.lowColor,
			offset: 0
		});
		//gradientString = "0-" + l.lowColor + "-";
		zeroPercent = getZeroLocation(l);
		if (zeroPercent !== "noZero") {
			r.push({
				color: l.middleColor,
				offset: zeroPercent
			});
			//gradientString += l.middleColor + ":" + zeroPercent + "-";
			l.middleTextPos = zeroPercent;
		}
		r.push({
			color: l.highColor,
			offset: 1
		});
		return r;
	}

	function legendLocation(m) {
		if (typeof(m.legendLocation) === "undefined") {
			m.legendLocation = "bottom";
		}
		var legendPosition = 600;
		if (m.legendLocation === "top") {
			legendPosition = -50;
		}
		return legendPosition;
	}

	function applyLegendAttrs(obj, attr) {
		for (var key in attr) {
			if (attr.hasOwnProperty(key)) {
				obj.attr(key, attr[key]);
			}
		}
	}

	function drawGradient(m, left, width, l, legendAttrs) {
		var zeroPercent;
		var _legendLocation = legendLocation(m);
		m.legendBox = m.paper.append("rect")
			.attr("x",left)
			.attr("y", legendLocation(m))
			.attr("width", width)
			.attr("height", 20);
		//Fill with gradient string
		m.paper.select("#legendGradient").remove();
		m.paper.append("linearGradient")
			.attr("id","legendGradient")
			.selectAll("stop")
			.data(makeGradientData(l))
			.enter()
			.append("stop")
			.attr("offset", function(d) {return d.offset;})
			.attr("stop-color", function(d) {return d.color;});



		//m.legendBox.attr("fill", makeGradientString(l));
		m.legendBox.attr("stroke", m.colorConfig.borderColor);
		m.legendBox.attr("stroke-width", m.borderWidth);
		m.legendBox.attr("fill","url(#legendGradient)");
		//Make new left legend label
		m.leftLegendText = m.paper.append("text")
			.attr("x",left)
			.attr("y", _legendLocation + 35)
			.attr("dy", legendAttrs["font-size"]/3)
			.text(l.formatter(l.lowValue));
		applyLegendAttrs(m.leftLegendText, legendAttrs);
		m.leftLegendText.attr(legendAttrs);
		//The rest of l is pretty much the same for the other labels
		m.rightLegendText = m.paper.append("text")
			.attr("x",left + width)
			.attr("y", _legendLocation + 35)
			.attr("dy", legendAttrs["font-size"]/3)
			.text(l.formatter(l.highValue));
		legendAttrs["text-anchor"] = "end";
		applyLegendAttrs(m.rightLegendText, legendAttrs);

		zeroPercent = getZeroLocation(l);
		if (zeroPercent !== "noZero") {
			m.middleLegendText = m.paper.attr("x",left + width * zeroPercent / 100)
				.attr("y", _legendLocation + 35)
				.attr("dy", legendAttrs["font-size"]/3)
				.text(l.formatter(0));
			legendAttrs["text-anchor"] = "middle";
			applyLegendAttrs(m.middleLegendText, legendAttrs);
		}
	}


	function drawBins(m, left, width, legendAttrs) {
		m.legendBins = [];
		if (typeof(legendAttrs["font-size"])==="undefined") {
			legendAttrs["font-size"] = 26;
		}

		/*adjust legend line height in super hacky way*/
		var adjust = 0,
			adjuster = function() {
			var dy = $(this).attr("dy") - adjust;
			adjust += 8;
			$(this).attr("dy", dy);
		};

		var _legendLocation = legendLocation(m);
		var binsToDraw = [], includeBin;
		for (var i = 0, ii = m.colorBins.length; i<ii; i++) {
			includeBin = true;
			if (typeof(m.colorBins[i].hideFromLegend)!=="undefined") {
				if (m.colorBins[i].hideFromLegend === true) {
					includeBin = false;
				}
			}
			if (includeBin) {
				binsToDraw.push(m.colorBins[i]);
			}
		}
		for (i = 0, ii = binsToDraw.length; i < ii; i++) {
			m.legendBins[i] = {};
			var box_size = Math.round(legendAttrs["font-size"]*0.8);
			m.legendBins[i].box = m.paper.append("rect")
				.attr("x",left + (i / ii) * width)
				.attr("y", _legendLocation + box_size*0.5)
				.attr("height", box_size)
				.attr("width", box_size);
			m.legendBins[i].box.attr("fill", binsToDraw[i].color);
			m.legendBins[i].box.attr("stroke", m.colorConfig.borderColor);
			m.legendBins[i].box.attr("stroke-width", m.borderWidth);
			m.legendBins[i].label = m.paper.append("text")
				.attr("x",left + (i / ii) * width + box_size+2)
				.attr("y", _legendLocation + box_size+2)
				.attr("dy", legendAttrs["font-size"]/3)
				.text(binsToDraw[i].customLabel);
			applyLegendAttrs(m.legendBins[i].label, legendAttrs);
			//alignTop(m.legendBins[i].label);
			$(m.legendBins[i].label[0]).children("tspan").each(adjuster);
			adjust = 0;
		}
	}

	function deleteLegendBins(m) {
		if (typeof (m.legendBins) !== "undefined") {
			for (var i = 0, ii = m.legendBins.length; i < ii; i++) {
				if (m.legendBins[i].box) {
					m.legendBins[i].box.remove();
				}
				if (m.legendBins[i].label) {
					m.legendBins[i].label.remove();
				}
			}
			delete m.legendBins;
		}
	}

	return {
		/*Set the legend data bounds*/
		setBounds: function (low, high) {
			this.lowValue = low;
			this.highValue = high;
		},

		/*Set the legend coors*/
		defineColors: function (low, high, middle) {
			this.lowColor = low;
			this.highColor = high;
			if (typeof (middle) !== "undefined") {
				this.middleColor = middle;
			}
		},

		/*Default legend label number formatter (do nothing)*/
		formatter: function (t) {
			return t;
		},

		/*Set a custom legend label formatter*/
		setFormatter: function (formatter) {
			this.formatter = formatter;
		},

		/*Draw the legend*/
		draw: function (m) {
			var left = m.viewX * 0.15, //goes from 15% to 85%
				width = m.viewX * 0.7;

			//Delete existing legend
			if (m.legendBox) {
				m.legendBox.remove();
			}

			//Delete left legend label
			if (m.leftLegendText) {
				m.leftLegendText.remove();
			}

			//Delete right legend label
			if (m.rightLegendText) {
				m.rightLegendText.remove();
			}

			//Delete middle legend label
			if (m.middleLegendText) {
				m.middleLegendText.remove();
			}

			//Delete bins
			deleteLegendBins(m);

			var legendAttrs = {
				"font-size": m.legendLabelSize,
				"font-family": m.fontFamily,
				"text-anchor": "start"
			};

			if (typeof (m.colorBins) !== "undefined") {
				drawBins(m, left, width, legendAttrs);
			} else {
				drawGradient(m, left, width, this, legendAttrs);
			}
		}
	};
};
