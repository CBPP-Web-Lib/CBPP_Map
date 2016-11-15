/*globals CBPP*/
CBPP.Map.mapevents = function (m) {
    "use strict";
    
    /*This module expects a map object to be passsed to it (m) so it can tack on
    the new event-related functions.*/

    /*Runs any time the mouse moves to keep track of its location*/
    m.applyMousePos = function (e) {
        //Create the tracking object if it doesn't exist
        if (typeof (m.mousePos) === "undefined") {
            m.mousePos = {};
        }
        m.mousePos.x = e.clientX + $(window).scrollLeft();
        m.mousePos.y = e.clientY + $(window).scrollTop();
    };

    /*Wrapper around the above function specifically for mousemove event
    - this extra layer isn't stricly necessary but I wanted to separate 
    out the mousemove code and the touchscreen code if I ever need it to 
    be different*/
    m.mouseTracker = function (e) {
        m.applyMousePos(e);
    };

    //Runs on mouse entry into state (or touch event on mobile)
    m.hoverIn = function (e) {
        var state = m.stateCodes[this.id];

        /*Stop the all popup fadeout event - it's only supposed to run
        when the mouse exits the map entirely. Later, the focusOn function
        has its own fadeout command to prevent fading out the popup
        that is fading in*/
        clearTimeout(m.popupFadeoutTimer);

        /*For touchscreens, the mousemove event never runs, so keep track of the
        touch location*/
        m.applyMousePos(e);

        /*Set the focus to happen in 0.1 seconds - delayed so that the box doesn't
        appear right on the edge of the state*/
        setTimeout(function () {
            m.focusOn(state);
        }, 100);
    };

    //Runs on mouse entry into state label (or touch event on mobile).
    //Basically the same as above except we get the state code differently
    m.labelHoverIn = function (e) {
        var state = this.attrs.text;
        clearTimeout(m.popupFadeoutTimer);
        m.applyMousePos(e);
        setTimeout(function () {
            m.focusOn(state);
        }, 100);
    };

    //Runs when the user leaves a state and triggers the removeFocus method
    m.hoverOut = function () {
        var state = m.stateCodes[this.id];
        m.removeFocus(state);
    };

    //Or a label
    m.labelHoverOut = function () {
        var state = this.attrs.text;
        m.removeFocus(state);
    };

    m.removeFocus = function (s) {
        m.popupFadeoutTimer = setTimeout(function () {
            if (!m.cursorInsideHover) {
                $(".popup_container").fadeOut(200, function () {
                    $(this).remove();
                });
                setTimeout(function () {
                    m.focusedState = "none";
                    m.revertFocusColor(s, 300);
                }, 200);
            }
        }, 300);
    };

    //The user can pass in a click callback which gets run here.
    m.mouseClick = function () {
        var state = m.stateCodes[this.id];
        m.stateClick(state);
    };

    //Here too.
    m.labelMouseClick = function () {
        var state = this.attrs.text;
        m.stateClick(state);
    };

    //Method to return the state to its original color after it's been unfocused
    m.revertFocusColor = function (s, duration) {

        /*This is an object to keep track of any animations that are running
        and I can't think of any particular reason why it wouldn't already exist
        at this point in the code, but may as well check*/
        if (typeof (m.animationRefs) === "undefined") {
            m.animationRefs = {};
        }

        /*If the state is currently animating, stop*/
        if (m.animationRefs[s]) {
            m.animationRefs[s].stopAnimation();
        }

        /*Start a new animation back to the original color*/
        m.animationRefs[s] = m.colors.animateStateColor(s, m.colors.stateColors[s], duration);
    };

    /*Fadeout events won't run as long as the cursor's inside the popup*/
    m.cursorInsideHover = false;
    $(m.mapSelector).on("mouseenter touchstart", ".popup", function () {
        m.cursorInsideHover = true;
    });

    /*But as soon as the cursor leaves the popup, get rid of it*/
    $(m.mapSelector).on("mouseleave touchend", ".popup", function () {
        m.cursorInsideHover = false;
        var state = $(this).parents("div.popup_container").data("state");
        m.removeFocus(state);
    });

    $(m.mapSelector).click(function () {
        setTimeout(function () {
            m.zoomOut();
        }, 1);
    });

    m.calcTextTransform = function () {
        m.textTransform = Math.min(1, m.width / m.fullScaleWidth);
    };
    m.calcTextTransform();
    m.setMapOpacity = function (opacity, exceptEls) {
        function o(obj, op) {
            if (typeof (obj) !== "undefined") {
                if (obj.node !== null) {
                    obj.attr({
                        "fill-opacity": op,
                        "stroke-opacity": op
                    });
                    if (op === 0) {
                        obj.hide();
                    } else {

                        if (obj.node.style.display === "none") {
                            obj.show();
                        }
                    }
                }
            }
        }
        var exceptElOs = [];
        for (var i = 0, ii = exceptEls.length; i < ii; i++) {
            exceptElOs[i] = exceptEls[i].attr("opacity");
        }
        for (var otherState in m.stateObjs) {
            if (m.stateObjs.hasOwnProperty(otherState)) {
                o(m.stateObjs[otherState], opacity);
            }
        }
        for (var label in m.stateLabelObjs) {
            if (m.stateLabelObjs.hasOwnProperty(label)) {
                o(m.stateLabelObjs[label], opacity);
            }
        }
        for (var line in m.maplines) {
            if (m.maplines.hasOwnProperty(line)) {
                for (var j = 0, jj = m.maplines[line].length; j < jj; j++) {
                    o(m.maplines[line][j], opacity);
                }
            }
        }

        m.legendBox.attr("fill", "#fff");
        o(m.legendBox, opacity);
        o(m.leftLegendText, opacity);
        o(m.middleLegendText, opacity);
        o(m.rightLegendText, opacity);
        for (i = 0, ii = exceptEls.length; i < ii; i++) {
            o(exceptEls[i], exceptElOs[i]);
        }
    };
    m.zoomFrame = function () {
        var scale, opacity, state = m.stateObjs[m.zoomedState], p = m.zoomAnimation.progress;
        scale = Math.round((p * 1.5 + 1) * 100) / 100;
        opacity = Math.round((1 - p) * 100) / 100;
        state.transform("s" + scale + "T" + Math.round(p * m.zoomedStateTranslation.x) + "," + Math.round(p * m.zoomedStateTranslation.y));
        m.setMapOpacity(opacity, [state]);
    };
    m.zoomOut = function (onComplete) {
        if (m.zooming) {
            return false;
        }
        if (typeof (m.zoomedState) !== "string") {
            return false;
        }
        m.zoomOutStart();
        m.zooming = true;
        m.zoomAninimation = {};
        m.zoomAnimation.progress = 1;

        m.zoomAnimation.interval = setInterval(function () {
            m.zoomAnimation.progress -= 0.2;
            if (m.zoomAnimation.progress <= 0) {
                m.zoomAnimation.progress = 0;
            }
            m.zoomFrame();
            if (m.zoomAnimation.progress === 0) {
                clearInterval(m.zoomAnimation.interval);
                m.zoomedState = null;
                m.zooming = false;
                m.makeLegend();
                if (typeof (onComplete) === "function") {
                    onComplete();
                }
            }
        },40);
    };
    m.zoomToState = function (s) {
        /*check if alreayd zoomed into state*/
        if (m.isCanvasSupported === false) {
            return false;
        }
        if (m.zoomedState) {
            if (m.zoomedState === s) {
                return false;
            } else {
                /*zoom out first*/
                m.zoomOut();
            }
        }
        if (m.zooming) {
            return false;
        }
        m.zoomedState = s;
        m.zooming = true;
        var bbox = m.stateObjs[s].getBBox();
        m.zoomedStateTranslation = {
            x: 0 - (bbox.x - bbox.width * 0.75) + 0.5 * m.width / m.scaleFactor - 0.5 * bbox.width * 2.5,
            y: 0 - (bbox.y - bbox.height * 0.75) + 0.5 * m.height / m.scaleFactor - 0.5 * bbox.height * 2.5
        };
        m.zoomAnimation = {};
        m.zoomAnimation.progress = 0;
        m.zoomAnimation.interval = setInterval(function () {
            m.zoomAnimation.progress += 0.2;
            if (m.zoomAnimation.progress >= 1) {
                m.zoomAnimation.progress = 1;
            }
            m.zoomFrame();
            if (m.zoomAnimation.progress === 1) {
                clearInterval(m.zoomAnimation.interval);
                m.zooming = false;
            }
        }, 40);
    };

    /*Focus on the state*/
    m.focusOn = function (s) {
        if (m.stateObjs[s][0] === null) {
            return false;
        }

        var //coords,
            //prop,
            box_anchor,
            verticalAlign = "top",
            horizontalAlign = "left",
            popup,
            popup_container,
            // popup_subcontainer,
            // stateAnimation,
            // oldStateAnimation,
            animatingState,
            offset,
            w;

        //Check if there's a previously focused state
        if (m.focusedState) {

            //If the state's already focused, do nothing
            if (m.focusedState === s) {
                return false;
            }

            //Unfocus the previously focused state
            if (m.focusedState !== "none") {
                m.revertFocusColor(m.focusedState, 200);
            }
        }

        //Define the new state as the focused state
        m.focusedState = s;

        //The popup box base coordinate comes from the mouse tracker
        box_anchor = [m.mousePos.x, m.mousePos.y];
        /*Break the canvas up into quandrants and draw the box on the correct
        side of the cursor based on its quadrant*/
        offset = $(m.mapSelector).offset();
        if (box_anchor[0] > m.width / 2 + offset.left) {
            horizontalAlign = "right";
        }
        if (box_anchor[1] > m.height / 2 + offset.top) {
            verticalAlign = "bottom";
        }

        //Fade out the visible popup
        $(".popup_container").fadeOut(200, function () {
            $(this).remove();
        });

        /*Create the animation tracker if it doesn't exist*/
        if (typeof (m.animationRefs) === "undefined") {
            m.animationRefs = {};
        }

        /*Loop through any states that are currently animating (i.e. changing color)*/
        for (animatingState in m.animationRefs) {
            if (m.animationRefs.hasOwnProperty(animatingState)) {
                if (m.animationRefs[animatingState]) {

                    //Stop the animation
                    m.animationRefs[animatingState].stopAnimation();

                    //Start a new animation back to the original color
                    m.animationRefs[animatingState] = m.colors.animateStateColor(animatingState, m.colors.stateColors[animatingState], 200);
                }
            }
        }

        /*This should have been covered in the previous loop, but whatever - if the
        focused state is animating, stop it*/
        if (m.animationRefs[s]) {
            m.animationRefs[s].stopAnimation();
        }

        /*Animate the state to the focus color.*/
        m.animationRefs[s] = m.colors.animateStateColor(s, m.colors.colorConfig.hoverColor, 200);

        if (typeof (m.disablePopupsOn) !== "undefined") {
            if (typeof (m.disablePopupsOn[s]) !== "undefined") {
                if (m.disablePopupsOn[s] === 1) {
                    return false;
                }
            }
        }
        if (m.disableAllPopups === true) {
            return false;
        }

        //Create a new popup
        popup_container = $("<div class='popup_container' id='popup_" + s + "'>");
        popup_container.css({
            "width": "0px",
            "height": "0px",
            "position": "absolute",
            "display": "none",
            "left": box_anchor[0] - offset.left,
            "top": box_anchor[1] - offset.top
        });
        popup_container.data("state", s);
        popup = $("<div class='popup'>");
        w = 190 * m.textTransform;
        popup.css({
            "width": w,
            "position": "absolute",
            "padding": m.popupStyle.padding + "px",
            "background-color": m.popupStyle.bgColor
        });
        try {
            //better (doesn't work in old IE)
            popup[0].style.setProperty("width", w + "px", "important");
        } catch (ex) { }
        popup.css(horizontalAlign, "2px");
        popup.css(verticalAlign, "2px");
        popup.html(m.popupTemplate(m.data, s));
        popup_container.append(popup);

        //append it to the map div
        $(m.mapSelector).append(popup_container);

        //fade it in
        popup_container.fadeIn(100);
        popup_container.find("p, h1, h2, h3, h4, h5, h6, ul, ol").each(function () {
            var scaleFactor = m.textTransform;
            var newHeight = $(this).css("font-size").split('px')[0] * scaleFactor + "px";
            var newPad = $(this).css("padding-left").split('px')[0] * scaleFactor + "px";
            $(this).css("font-size", newHeight);
            $(this).css("padding-left", newPad);
        });
    };

    /*Assign all these events to the actual Raphael objects*/
    m.applyHoverEvents = function () {
        var state;
        for (state in m.stateObjs) {
            if (m.stateObjs.hasOwnProperty(state)) {
                m.stateObjs[state].hover(m.hoverIn, m.hoverOut);
                m.stateObjs[state].mousemove(m.mouseTracker);
                m.stateObjs[state].click(m.mouseClick);
            }
        }
        for (state in m.stateLabelObjs) {
            if (m.stateLabelObjs.hasOwnProperty(state)) {
                m.stateLabelObjs[state].hover(m.labelHoverIn, m.labelHoverOut);
                m.stateLabelObjs[state].click(m.labelMouseClick);
            }
        }
    };
    m.applyHoverEvents();
    $(m.mapSelector).on("click touchstart"," .popup", function() {
        var state = $(this).parents(".popup_container").attr("id").split("_")[1];
        m.stateClick(state);
    });
};
