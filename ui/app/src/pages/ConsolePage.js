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
class ConsolePage extends Page {
	
	#console = null;        // JQuery element
	
	async unload() {
		Console.removeCallbacks();
	}
	
	/**
	 * Shows the console
	 */
	async load() {
		var that = this;
		
		// Set note name in the header
		this._tab.setStatusText('Console');
		
		this.#console = $('<div class="console"/>');
		this._tab.getContainer().append(
			this.#console
		);

		// Append all messages to the console
		this.#buildConsole();
		
		// Set callbacks to the static console to get all of its changes
		Console.setLogCallback(this.#getCallbackId(), function(message, type, stack) {
			that.#addMessage(message, type, stack);
		});
		
		Console.setClearCallback(this.#getCallbackId(), function() {
			that.#clear();
		});
		
		// Scroll to last message
		this.#scrollToBottom();
		
		// Build buttons
		this._app.setButtons([ 
			$('<div type="button" data-toggle="tooltip" title="Clear console" class="fa fa-trash"></div>')
			.on('click', function(event) {
				event.stopPropagation();
				console.clear();
			}),
		]);
	}
	
	/**
	 * Returns the ID for callbacks
	 */
	#getCallbackId() {
		return 'console_' + this._getPageId();
	}

	/**
	 * Clear the console
	 */
	#clear() {
		this.#console.empty();
	}
	
	/**
	 * Fill all already buffered Console message into the container element
	 */
	#buildConsole() {
		var msgs = Console.buffer;
		
		for(var i in msgs) {
			var msg = msgs[i];
			
			this.#addMessage(msg.message, msg.type, msg.stack);
		}
	}
	
	/**
	 * Scroll to console to bottom
	 */
	#scrollToBottom() {
		var that = this;
		setTimeout(function() { 
			that.#console.scrollTop($("#console").prop("scrollHeight"));
		}, 0);
	}
	
	/**
	 * Add a message to the console element
	 */
	#addMessage(txt, type, stack) {
		this.#console.append(
			$('<div data-stack="' + stack + '" class="console-line console-type-' + type + ' ' + (txt ? '' : ' console-emptyline') + '"/>')
			.html(txt)
			.on('click', function(e) {
				e.stopPropagation();
				
				const stackAttr = $(this).attr('data-stack');
				if (!stackAttr) return;
				
				if ($(this).children().length > 0) {
					$(this).html(txt);
				} else {
					$(this).append(
						$('<div class="console-stack"></div>')
						.html(stackAttr.substr(6))
					);
				}
			})
		);
		
		this.#scrollToBottom();
	}
}