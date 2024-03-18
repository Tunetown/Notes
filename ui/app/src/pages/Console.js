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
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!Console.instance) Console.instance = new Console();
		return Console.instance;
	}

	/**
	 * Adds a wrapper to the standard console log function, to collect everything here.
	 * 
	 * Adapted from https://stackoverflow.com/questions/19846078/how-to-read-from-chromes-console-in-javascript
	 */
	init() {
		// Create wrappers to the standard log functions
		console.stdlog = console.log.bind(console);
		console.stdinfo = console.info.bind(console);
		console.stdwarn = console.warn.bind(console);
		console.stderror = console.error.bind(console);
		
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
					Console.getInstance().#log(JSON.stringify(arg, null, 4), type);
				} else { 
					Console.getInstance().#log(arg, type);
				}
			} catch (e) {
				Console.getInstance().#log(e.stack, 'E');
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

		// Get persisted messages from memory
		var cs = ClientState.getInstance().getConsoleSettings();
		if (cs.log) {
			for (var l in cs.log) {
				this.#log(
					cs.log[l].msg,
					cs.log[l].type,
					true	
				);
			}
		}

		this.#log("================== Console initialized at " + new Date().toLocaleDateString() + " ====================", 'I');		
	}
	
	/**
	 * Clear console with optional intro text
	 */
	clear() {
		$('#console').empty();
		
		var cs = ClientState.getInstance().getConsoleSettings();
		if (cs.log) cs.log = [];
		ClientState.getInstance().saveConsoleSettings(cs);
		
		this.#log("================== Console initialized at " + new Date().toLocaleDateString() + " ====================", 'I');
	}
	
	/**
	 * Set title for console (header text)
	 */
	setTitle(title) {
		this.title = title;
	}
	
	/**
	 * Shows the console
	 */
	show() {
		var n = Notes.getInstance();
		n.setCurrentPage(this);
		
		// Set note name in the header
		n.setStatusText(this.title ? this.title : "Console");
		
		// Switch to this view
		$('#contentContainer').hide();
		$('#console').show();
		
		this.scrollToBottom();
		
		// Build buttons
		n.setButtons([ 
			$('<div type="button" data-toggle="tooltip" title="Clear console" class="fa fa-trash" onclick="event.stopPropagation();Console.getInstance().clear()"></div>'),
		]);
	}
	
	/**
	 * Scroll to console to bottom
	 */
	scrollToBottom() {
		// Scroll down
		setTimeout(function() { 
			$('#console').scrollTop($("#console").prop("scrollHeight"));
		}, 0);
	}
	
	/**
	 * Logging (internal for all types).
	 */
	#log(txt, type, dontPersist) {
		if (!txt) return;
		if (!type) type = "I";
		
		var timestamp = new Date().toLocaleTimeString();

		// Stack (on doubleclick)		
		var stack = '';
		switch(type) {
			case 'E':
				stack = this.#getStack();
				break; 
			case 'W':
				stack = this.#getStack();
				break;
		}
		
		// Call non-blocking
		setTimeout(function() {
			if (!dontPersist) {
				txt = timestamp + " " + txt;
			}

			if (!dontPersist) {
				var cs = ClientState.getInstance().getConsoleSettings();
				if (cs.persist) {
					if (!cs.log) cs.log = [];
					cs.log.push({
						msg: txt,
						type: type
					});
					ClientState.getInstance().saveConsoleSettings(cs);
				}
			}
			
			$('#console').append(
				$('<div data-stack="' + stack + '" class="console-line console-type-' + type + ' ' + (txt ? '' : ' console-emptyline') + '"/>').html(txt)
				.on('click', function(e) {
					e.stopPropagation();
					const stackAttr = $(this).attr('data-stack');
					if (!stackAttr) return;
					
					if ($(this).children().length > 0) {
						$(this).html(txt);
					} else {
						$(this).append(
							$('<div class="console-stack"></div>').html(stackAttr.substr(6))
						);
					}
				})
			);
			
			Console.getInstance().scrollToBottom();
		}, 0);
	}
	
	/**
	 * Returns call stack with this file removed
	 */
	#getStack() {
		var err = new Error().stack.split(/\r?\n/);
		
		var ret = '';
		for(var e in err) {
			if (err[e].includes('Console.js')) continue;
			
			ret += err[e] + "\n";
		}
		return ret;
	}
}