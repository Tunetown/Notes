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
	
	#callbacks = null;
	#errorHandler = null;
	
	constructor(errorHandler) {
		this.#callbacks = new Map();
		this.#errorHandler = errorHandler;
	}
	
	/**
	 * Registers a callback for the given action ID. The callbacks will be called after
	 * the action has taken place.
	 * 
	 * Parameters to the callback are always: (data), where data is a parameter depending on the type of action.
	 * Each callback can optionally return a promise which is waited for before continuing.
	 */
	registerCallback(processId, actionId, callback, priority) {
		var cb = this.#callbacks.get(actionId);
		
		if (!cb || !cb.handlers) {
			// No data yet: Create handlers array and map entry
			cb = {
				handlers: []
			};
			
			this.#callbacks.set(actionId, cb);
		}

		// Add handler
		cb.handlers.push({
			processId: processId, 
			callback: callback,
			priority: priority ? priority : 0
		});
		
		// Sort handlers by priority
		cb.handlers.sort(function(a, b) {
			b.priority - a.priority;
		});
	}
	
	/**
	 * Delete all callbacks for the given processID.
	 */
	deleteCallbacks(processId) {
		for(var [actionId, list] of this.#callbacks) {
			list.handlers.filter(function(item) {
				return item.processId != processId;
			});
		}
	}
	
	/**
	 * Executes the callbacks for a given action.
	 */
	async executeCallbacks(actionId, data) {
		var cb = this.#callbacks.get(actionId);
		if (!cb || !cb.handlers) return;
		
		for(var i in cb.handlers) {
			var handler = cb.handlers[i];
			
			if (handler.callback) {
				try {
					await handler.callback(data);
				} catch (e) {
					this.#errorHandler.handle(e);
				}
			}
		}
	}
}
	