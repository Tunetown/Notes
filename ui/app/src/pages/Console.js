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
		// Set the standard log to stdlog
		console.stdlog = console.log.bind(console);
		
		// Se a new log function which records everything before doing normal log output.
		console.log = function(){
			// Standard logging to browser console
			console.stdlog.apply(console, arguments);

			// Logging to the app console (done recursively to parse all deep types if possible)
			if (!arguments) {
				return;
			}
			
			function logit(arg) {
				if (typeof(arg) == "array") {
					for(var l in arg) {
						logit(arg[l]);
					}
				} else if (typeof(arg) == "object") {
					Console.getInstance().logInternal(JSON.stringify(arg, null, 4), 'J');
				} else { 
					Console.getInstance().logInternal(arg, 'J');
				}
			}
		
			for(var l in arguments) {
				logit(arguments[l]);
			}
		}
		
		var cs = ClientState.getInstance().getConsoleSettings();
		if (cs.log) {
			for (var l in cs.log) {
				this.log(
					cs.log[l].msg,
					cs.log[l].type,
					true	
				);
			}
		}

		this.log("================== Console initialized at " + new Date().toLocaleDateString() + " ====================", 'I');		
	}
	
	/**
	 * Clear console with optional intro text
	 */
	clear() {
		$('#console').empty();
		
		var cs = ClientState.getInstance().getConsoleSettings();
		if (cs.log) cs.log = [];
		ClientState.getInstance().saveConsoleSettings(cs);
		
		this.log("================== Console initialized at " + new Date().toLocaleDateString() + " ====================", 'I');
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
	 * Static wrapper for log()
	 */
	static log(txt, type) {
		Console.getInstance().log(txt, type);
	}
	
	/**
	 * Loads the passed version history data into the versions view.
	 * Asynchronously executed.
	 *
	 * dontPersist is just internally used here to add the logs from local storage in init().
	 */
	log(txt, type, dontPersist) {
		if (dontPersist) {
			this.logInternal(txt, type, true);
			return;
		}
		
		if (typeof(txt) == "array") {
			for(var l in txt) {
				this.log(txt[l], type);
			}
		} else if (typeof(txt) == "object") {
			Console.getInstance().logInternal(JSON.stringify(txt, null, 4), type);
		} else { 
			Console.getInstance().logInternal(txt, type);
		}
	}
	
	/**
	 * Internally used by log(...).
	 */
	logInternal(txt, type, dontPersist) {
		var stack = new Error().stack;
		var timestamp = new Date().toLocaleTimeString();
		
		setTimeout(function() {
			if (!type) type = "I";
			
			if (!txt || txt.length == 0) {
				type = 'B';
				txt = '.';
			} else {
				if (!dontPersist) {
					txt = timestamp + ": " + txt;
				}
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
				.on('dblclick', function(e) {
					e.stopPropagation();

					if ($(this).children().length > 0) {
						$(this).html(txt);
					} else {
						$(this).append(
							$('<div class=".consoleStack"></div>').html($(this).attr('data-stack').substr(6))
						);
					}
				})
			);
			
			Console.getInstance().scrollToBottom();
		}, 0);
	}
}