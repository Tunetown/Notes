/**
 * Handler which registers touch and mouse events to an element,
 * automatically detecting the various quirks etc. which come 
 * up in this scenario.
 * 
 * (C) Thomas Weber 2021 tom-vibrant@gmx.de
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
class TouchClickHandler {
	
	/**
	 * element: The element to attach the events to
	 * options: Object holding the callbacks and options. The following are defined:
	 * 
	 * onGestureStartCallback:  The callback at event start (optional) 
	 *                          Parameters: (event)
	 *                          
	 * onGestureFinishCallback: The callback that should be handled (optional) 
	 *                          Parameters: (event)
	 *                          
	 * delayedHoldCallback:     Called after the user held down the button/finger for an amount of 
	 *                          time (optional)
	 *                          Parameters: (event)
	 *                          
	 * delayHoldMillis:         The amount of time the user has to hold before delayedHoldCallback 
	 *                          is called (optional, must be > 0 when delayedHoldCallback shall be used) 
	 *                          (numeric)
	 *                          
	 * mouseEventBlockMillis:   Milliseconds to block mouse events after touch end (default: 10) 
	 *                          (numeric)
	 *                          
	 * dontStopPropagation:     Do not stop event propagation. Default: false.
	 *                          (boolean)
	 *                          
	 */
	constructor(element, options) {
		// Option defaults
		if (!options.mouseEventBlockMillis) options.mouseEventBlockMillis = 10;
		
		// We use some position markers to track user activity, which are initialised here to reduce object garbage.
		this.currentPos = {
			x: -1,
			y: -1
		};
		this.posAtStart = {
			x: -1,
			y: -1
		}
		
		var that = this;

		// Register all events to the element. First the touch events:
		$(element).on('touchstart', function(event) {
			if (!options.dontStopPropagation) event.stopPropagation();
			
			// After touch finish, block the mouse events for the next few milliseconds. Normally,
			// the touch events will trigger mouse down/click events afterwards for compatibility.
			// This would lead to double triggers if we allow them to be processed.
			that.blockMouseEvents();
			return that.eventStart(event, true);
		});
		
		$(element).on('touchend', function(event) {
			if (!options.dontStopPropagation) event.stopPropagation();
			
			// After touch finish, block the mouse events for the next few milliseconds. Normally,
			// the touch events will trigger mouse down/click events afterwards for compatibility.
			// This would lead to double triggers if we allow them to be processed.
			that.blockMouseEvents();
			return that.eventFinish(event, true);
		});
		
		// Then the mouse events, which only get executed when not blocked by a preceeding touch event.
		$(element).on('mousedown', function(event) {
			if (!options.dontStopPropagation) event.stopPropagation();
			
			// Only regard left button clicks.
			if (event.button != 0) return;
			
			if (TouchClickHandler.blocked) {
				return;
			}
			return that.eventStart(event, false);
		});
		
		$(element).on('click', function(event) {
			if (!options.dontStopPropagation) event.stopPropagation();
			
			if (TouchClickHandler.blocked) {
				return;
			}
			return that.eventFinish(event, false);
		});
		
		////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
		
		/**
		 * Event start (gesture start)
		 */
		this.eventStart = function(event, touch) {
			// Register move handler to track attempts to scroll
			$(element).on(touch ? 'touchmove' : 'mousemove', that.captureCurrentPosition);
			that.captureCurrentPosition(event);

			// Remember start position
			that.posAtStart.x = Tools.extractX(event);
			that.posAtStart.y = Tools.extractY(event);
			
			// If defined, start the delayed hold timer
			that.mouseDownTimerElapsed = false;
			if (options.delayedHoldCallback && options.delayHoldMillis > 0) {
				that.mouseDownTimer = setTimeout(function() {
					// Time has elapsed: Set a flag to signal this to eventFinish() 
					that.mouseDownTimerElapsed = true;
					
					// Check if the user has moved. In this case stop here.
					if (that.userHasMoved()) return;
					
					// Call the callback
					options.delayedHoldCallback(event);
				
				}, options.delayHoldMillis);
			}
			
			// If defined, call the start gesture callback
			if (options.onGestureStartCallback) {
				return options.onGestureStartCallback(event);
			}
		}
		
		/**
		 * Event end (gesture end)
		 */
		this.eventFinish = function(event, touch) {
			// Kill the eventually running hold timer
			that.killMouseDownTimer();
			
			// Detach the move handler again
			$(element).off('touchmove', that.captureCurrentPosition);
			$(element).off('mousemove', that.captureCurrentPosition);
			
			// Detect if the user has triggered the delayed hold function.
			// In this case we must not execute the click action. The hold
			// function sets an appropriate flag to signal this.
			if (that.mouseDownTimerElapsed) {
				that.mouseDownTimerElapsed = false;
				return;
			}
			
			// If the user has moved position, he most likely wanted to scroll,
			// so we also exit here.
			if (that.userHasMoved(event)) return; 
			
			// Call the gesture finish callback.
			if (options.onGestureFinishCallback) {
				return options.onGestureFinishCallback(event);
			}
		}
		
		/**
		 * Blocks mouse events for the next few milliseconds globally.
		 */
		this.blockMouseEvents = function() {
			if (TouchClickHandler.blockHandler) clearTimeout(TouchClickHandler.blockHandler);
			TouchClickHandler.blocked = true;
			TouchClickHandler.blockHandler = setTimeout(function() {
				TouchClickHandler.blocked = false;
			}, 100);
		}
		
		/**
		 * Kills the delayed hold timer
		 */
		this.killMouseDownTimer = function() {
			if (!that.mouseDownTimer) return;

			clearTimeout(that.mouseDownTimer);
			that.mouseDownTimer = null;
		}
		
		/**
		 * Saves the current user position in an instance attribute (currentPos)
		 */
		this.captureCurrentPosition = function(event) {
			that.currentPos.x = Tools.extractX(event);
			that.currentPos.y = Tools.extractY(event);
		}
			
		/**
		 * Tells if the user has been moved since posAtStart has been set.
		 */
		this.userHasMoved = function(event) {
			if (!that.posAtStart) return false;
			if (!that.currentPos) return false;
			if (!that.currentPos.x) return false;
			if (!that.currentPos.y) return false;
			if (that.currentPos.x < 0) return false;
			if (that.currentPos.y < 0) return false;
			
			var x, y;
			if (event) {
				x = Tools.extractX(event);
				y = Tools.extractY(event);
				if (x < 0) x = that.currentPos.x;
				if (y < 0) y = that.currentPos.y;
			} else {
				x = that.currentPos.x;
				y = that.currentPos.y;
			}
			
			var xdiff = Math.abs(x - that.posAtStart.x);
			var ydiff = Math.abs(y - that.posAtStart.y);
			return Math.max(xdiff, ydiff) > 20;
		}
	}
}