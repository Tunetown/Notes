/**
 * Online status sensor
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
class OnlineSensor {
	
	#app = null;
	
	constructor(app) {
		this.#app = app;
	}
	
	/**
	 * Starts a timer that periodically checks if the app is online
	 */
	start(millis, callback) {
		this.detectOnlineState()
		.then(function(data) {
			callback(data);
		});
		
		var that = this;
		setTimeout(function() {
			that.start(millis, callback);
		}, millis);
	}
	
	/**
	 * Notifies the online state sensor that there might be a problem.
	 */
	checkNextTime() {
		this.checkNextTimeFlag = true;
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Internally used by the senser. Returns a promise holding an onLine flag.
	 */
	detectOnlineState() {
		if (this.checkNextTimeFlag) {
			if (!Tools.isOnline()) return Promise.resolve({
				onLine: false
			});
			
			// If true AND someone told us that we are probably offline, we have to check the DB again.
			var that = this;
			return this.#app.db.checkRemoteConnection()
			.then(function(data) {
				that.checkNextTimeFlag = false;
				
				return Promise.resolve({
					onLine: true
				});
				
			}).catch(function(err) {
				return Promise.resolve({
					onLine: false
				});
			});
		} else {
			return Promise.resolve({
				onLine: Tools.isOnline()
			});
		}
	}
}
	