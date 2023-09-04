/**
 * Device handling
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
class Device {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!Device.instance) Device.instance = new Device();
		return Device.instance;
	}
	
	/**
	 * Call this at page load.
	 */
	init() {
		// Detect device properties (buffered, because the calls to the is* functions
		// are plenty and can affect performance severely)
		this.currentMobileState = this.#isReallyMobile();
		this.currentTouchAwareState = this.#isReallyTouchAware();
		
		// Reload or refresh page some milliseconds after resizing has stopped
		var that = this;
		window.onresize = function() {
			if (that.resizeHandler) clearTimeout(that.resizeHandler);
			
			that.resizeHandler = setTimeout(function() {
				if (that.#isReallyMobile() != that.currentMobileState) {
					that.currentMobileState = that.#isReallyMobile();
					
					location.reload();
				} else {
					Notes.getInstance().refresh();
				}
			}, 50);
		}
		
		console.log("Device is " + (this.currentTouchAwareState ? '' : 'not ') + "touch aware");
	}
	
	/**
	 * Returns if we are on a small mobile device.
	 */
	isLayoutMobile() {
		return this.currentMobileState;
	}
	
	/**
	 * Returns if we are on a touch aware device
	 */
	isTouchAware() {
		return this.currentMobileState;
	}

	/**
	 * Returns if we are on a small mobile device (unbuffered).
	 */
	#isReallyMobile() {
		var mode = ClientState.getInstance().getMobileOverride();
		if (mode) {
			if (mode == "mobile") return true;
			if (mode == "desktop") return false;
		}
		
		const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
		return vw <= 800;
	}

	/**
	 * Returns if we are on a touch aware device (unbuffered).
	 */
	#isReallyTouchAware() {
		var mode = ClientState.getInstance().getTouchAwareOverride();
		if (mode) {
			if (mode == "touch") return true;
			if (mode == "notouch") return false;
		}
		
		return ( 'ontouchstart' in window ) ||
           ( navigator.maxTouchPoints > 0 ) ||
           ( navigator.msMaxTouchPoints > 0 );
	}

	/**
	 * Disables the back swipe gesture. 
	 * Taken from https://www.outsystems.com/forums/discussion/77514/disable-swipe-to-previous-screen-some-android-and-ios/
	 *
	disableBackSwipe() {
		document.addEventListener('touchstart', function(e) {
			var x = e.touches[0].pageX;
			console.log(x);
			if (x > 10 && x < window.innerWidth - 10) return;
		    e.preventDefault();
		}, { passive: false });
	}
	*/	
}
	