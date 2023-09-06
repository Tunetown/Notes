/**
 * WakeLock API facade
 * 
 * (C) Thomas Weber 2023 tom-vibrant@gmx.de
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
class WakeLock {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!WakeLock.instance) WakeLock.instance = new WakeLock();
		return WakeLock.instance;
	}

	/**
	 * Returns if wake lock is supported
	 */
	isSupported() {
		return ('wakeLock' in navigator);
	}	
	
	/**
	 * Activate wake lock
	 */
	async lock() {
		if (!this.isSupported()) {
			console.log("Wake lock is not supported");
			return Promise.reject({
				message: "Wake lock is not supported",
				notSupported: true
			});
		}
		
		if (this.isLocked()) {
			console.log('Wake lock already active');
			return Promise.resolve();
		}
		
		try {
			this.lockHandle = await navigator.wakeLock.request('screen');
			
			console.log('Acquired wake lock');
			
			return Promise.resolve();
			
		} catch (err) {
			console.log("Error requesting wake lock");
			if (err) console.log(err);
			
			return Promise.reject({
				message: "Error requesting wake lock",
				err: err
			});
		}
	}
	
	/**
	 * Returns if the wake lock is active
	 */
	isLocked() {
		return !!this.lockHandle;
	}
	
	/**
	 * Release wake lock
	 */
	async release() {
		if (!this.isSupported()) {
			return Promise.reject({
				message: "Wake lock is not supported",
				notSupported: true
			});
		}
		
		if (!this.isLocked()) {
			//console.log("No wake lock to release");
			return Promise.resolve();
		}
		
		var that = this;
		return this.lockHandle.release()
		.then(function(data) {
			that.lockHandle = null;
			
			console.log("Wake lock released");
			
			return Promise.resolve(data);
		});
	}
}
	