/**
 * Shows a debug console output window
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
class Console {
	
	static buffer = [];    // Message buffer: { message:string, type:string, stack:string }
	static #state = null;  
	static #callbacks = null;
	
	/**
	 * Adds a wrapper to the standard console log function, to collect everything here.
	 * 
	 * Adapted from https://stackoverflow.com/questions/19846078/how-to-read-from-chromes-console-in-javascript
	 */
	static init() {
		// This class has its own ClientState instance which has no access to the app itself
		Console.#state = new ClientState(null);
		
		// We use a map of callbacks for custom hooks
		Console.#callbacks = new Map();
		 
		// Create wrappers to the standard log functions
		console.stdlog = console.log.bind(console);
		console.stdinfo = console.info.bind(console);
		console.stdwarn = console.warn.bind(console);
		console.stderror = console.error.bind(console);
		console.stdclear = console.clear.bind(console);
		
		/**
		 * Helper function, which does the acrtual logging
		 */
		function logit(arg, type) {
			try {
				if (typeof(arg) == "array") {
					for(var l in arg) {
						logit(arg[l]);
					}
				} else if (typeof(arg) == "object") {
					Console.#log(JSON.stringify(arg, null, 4), type);
				} else { 
					Console.#log(arg, type);
				}
			} catch (e) {
				Console.#log(e.stack, 'E');
			}
		}
	

		// Set a new log functions which records everything before doing normal log output.
		console.info = function() {
			console.stdinfo.apply(console, arguments);     // Standard logging to browser console
			if (!arguments) return;                       // Logging to the app console (done recursively to parse all deep types if possible)
			
			for(var l in arguments) {
				logit(arguments[l], 'I');
			}
		}
		
		console.log = function() {
			console.stdlog.apply(console, arguments);     // Standard logging to browser console
			if (!arguments) return;                       // Logging to the app console (done recursively to parse all deep types if possible)
			
			for(var l in arguments) {
				logit(arguments[l], 'L');
			}
		}

		console.warn = function() {
			console.stdwarn.apply(console, arguments);     // Standard logging to browser console
			if (!arguments) return;                       // Logging to the app console (done recursively to parse all deep types if possible)
			
			for(var l in arguments) {
				logit(arguments[l], 'W');
			}
		}

		console.error = function() {
			console.stderror.apply(console, arguments);     // Standard logging to browser console
			if (!arguments) return;                       // Logging to the app console (done recursively to parse all deep types if possible)
			
			for(var l in arguments) {
				logit(arguments[l], 'E');
			}
		}
		
		console.clear = function() {
			console.stdclear.apply(console);
			Console.#clear();
			
			Console.#welcomeMessage();
		}

		// Get persisted messages from memory
		var cs = Console.#state.getConsoleSettings();
		if (cs.log) {
			for (var l in cs.log) {
				Console.#log(
					cs.log[l].msg,
					cs.log[l].type,
					true	           // Dont persist
				);
			}
		}

		Console.#welcomeMessage();		
	}
	
	/**
	 * Sets a log callback
	 */
	static setLogCallback(id, callback) {
		if (!Console.#callbacks) throw new Exception('Console not initialized');
		
		var entry = Console.#callbacks.get(id) || {};
		
		entry.logCallback = callback;
		
		Console.#callbacks.set(id, entry);
	}
	
	/**
	 * Sets a log callback
	 */
	static setClearCallback(id, callback) {
		if (!Console.#callbacks) throw new Exception('Console not initialized');
		
		var entry = Console.#callbacks.get(id) || {};
		
		entry.clearCallback = callback;
		
		Console.#callbacks.set(id, entry);
	}
	
	/**
	 * Removes a callback by its ID
	 */
	static removeCallbacks(id) {
		if (!Console.#callbacks) throw new Exception('Console not initialized');
		Console.#callbacks.delete(id);
	}
	
	/**
	 * Outputs the welcome message (on the internal buffer only)
	 */
	static #welcomeMessage() {
		Console.#log("================== Console initialized at " + new Date().toLocaleDateString() + " ====================", 'I');
	}
	
	/**
	 * Clear internal buffer and persistent entries
	 */
	static #clear() {
		if (!Console.#state) throw new Exception('Console not initialized');
		
		Console.buffer = [];
		
		var cs = Console.#state.getConsoleSettings();
		cs.log = [];
		Console.#state.saveConsoleSettings(cs);
		
		// Callbacks
		for(var c in Console.#callbacks) {
			var entry = Console.#callbacks.get(c);
			if (!entry) continue;
			if (!entry.clearCallback) continue;
			entry.clearCallback();
		}
	}
	
	/**
	 * Logging (internal for all types).
	 */
	static #log(txt, type, dontPersist) {
		if (!Console.#state) throw new Exception('Console not initialized');
		if (!txt) return;
		if (!type) type = "I";
		
		var timestamp = new Date().toLocaleTimeString();

		// Stack (on doubleclick)		
		var stack = '';
		switch(type) {
			case 'E':
				stack = Console.#getStack();
				break; 
			case 'W':
				stack = Console.#getStack();
				break;
		}
		
		// Call non-blocking
		setTimeout(function() {
			if (!dontPersist) {
				txt = timestamp + " " + txt;

				var cs = Console.#state.getConsoleSettings();
				if (cs.persist) {
					if (!cs.log) cs.log = [];
					cs.log.push({
						msg: txt,
						type: type
					});
					Console.#state.saveConsoleSettings(cs);
				}
			}
			
			// Log the entry			
			Console.buffer.push({
				message: txt,
				type: type, 
				stack: stack
			});
			
			// Callbacks
			for(var c in Console.#callbacks) {
				var entry = Console.#callbacks.get(c);
				if (!entry) continue;
				if (!entry.logCallback) continue;
				entry.logCallback(txt, type, stack);
			}
		}, 0);
	}
	
	/**
	 * Returns call stack with this file removed
	 */
	static #getStack() {
		var err = new Error().stack.split(/\r?\n/);
		
		var ret = '';
		for(var e in err) {
			if (err[e].includes('Console.js')) continue;
			
			ret += err[e] + "\n";
		}
		return ret;
	}
}