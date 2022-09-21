/**
 * Generic callbacks.
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
class Callbacks {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!Callbacks.instance) Callbacks.instance = new Callbacks();
		return Callbacks.instance;
	}
	
	/**
	 * Registers a callback for the given action ID. The callbacks will be called after
	 * the action has taken place.
	 * 
	 * Parameters to the callback are always: (data), where data is a parameter depending on the type of action.
	 * Each callback can optionally return a promise which is waited for before continuing.
	 */
	registerCallback(processId, actionId, callback) {
		if (!this.callbacks) this.callbacks = new Map();
	
		var cb = this.callbacks.get(actionId);
		
		if (!cb) {
			cb = {};
			cb.handlers = new Map();
			this.callbacks.set(actionId, cb);
		}

		cb.handlers.set(processId, callback);
	}
	
	/**
	 * Delete all callbacks for the given processID.
	 */
	deleteCallbacks(processId) {
		if (!this.callbacks) return;
		
		for(var [actionId, list] of this.callbacks) {
			list.handlers.set(processId, null);
		}
	}
	
	/**
	 * Executes the callbacks for a given action.
	 */
	async executeCallbacks(actionId, data) {
		if (!this.callbacks) return;
		
		var cb = this.callbacks.get(actionId);
		if (!cb) return;
		
		var promises = [];
		for(var [processId, callback] of cb.handlers) {
			if (callback) {
				var p = callback(data);
				if (p) promises.push(p);
			}
		}
		
		if (promises.length > 0) {
			await Promise.all(promises);
		}
	}
	
}
	