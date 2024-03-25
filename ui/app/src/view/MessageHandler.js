/**
 * Note taking app - Main application controller class.  
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
class MessageHandler {  
	
	#messageElement = null;
	
	/**
	 * Add a global container to the body for the messages.
	 */
	init() {
		this.#messageElement = $('<tbody class="messages"/>');
		
		$('<div class="msgContainer" />').append(
    		$('<table />').append(
    			this.#messageElement
    		)
    	).appendTo('body');
	}

	/**
	 * Show a message to the user. Default type is "E" for error, other supported types are I(nfo), W(arning), and S(uccess).
	 * 
	 * options = {
	 *    threadID: false,                   <- If you pass a thread ID, all older messages with the same ID will be removed first.
	 *    alwaysHideAtNewMessage: false,     <- alwaysHideAtNewMessage can be used if you like to have the message disappearing whenever a new one comes in.
	 *    callback: false                    <- callbackFunction is executed on clicking the message.
	 * }
	 */
	message(msg, type, options) {
		if (!options) {
			options = {
				threadID: false, 
				alwaysHideAtNewMessage: false, 
				callback: false
			}
		}
		
		if (!type) type = 'E';
		
		var msgEl = $('<div class="singleMessageContainer">' + msg + '</div>');
		var msgCont = $('<tr />').append($('<td class="singleMessageContainerTd" />').append(msgEl));
		var fadeTime = 0;
		
		switch (type) {
		case 'E':
			msgEl.addClass("btn btn-danger");
			fadeTime = Config.MESSAGE_ERROR_FADEOUT_AFTER_MS;     // TODO fade out via CSS!
			console.error(msg);
			break;
		case 'W':
			msgEl.addClass("btn btn-warning");
			fadeTime = Config.MESSAGE_WARNING_FADEOUT_AFTER_MS;
			console.warn(msg);
			break;
		case 'S':
			msgEl.addClass("btn btn-success");
			fadeTime = Config.MESSAGE_SUCCESS_FADEOUT_AFTER_MS;			
			console.log(msg);
			break;
		case 'I':
			msgEl.addClass("btn btn-info");
			fadeTime = Config.MESSAGE_INFO_FADEOUT_AFTER_MS;
			console.log(msg);
			break;
		default:
			msgEl.addClass("btn btn-danger");
			fadeTime = Config.MESSAGE_OTHERS_FADEOUT_AFTER_MS; 
			console.error(msg);
			break;
		}

		// Click to remove
		msgEl.click(function(event) {
			event.stopPropagation(); 
			msgCont.remove();
			
			if (options.callback) {
				options.callback(msgCont, event);
			}
		});	

		// Add message at the top
		this.#messageElement.prepend(msgCont);

		// Fade out after a certain time
		if (fadeTime > 0) { 
			msgCont.msgTimeoutHandle = setTimeout(function() {
				if (msgCont && msgCont.fadeOut) msgCont.fadeOut();
			}, fadeTime);
		}
		
		// Hide messages of the same thread
		if (options.threadID) {
			this.#messageElement.children().each(function(el) {
				var tid = $(this).data("threadID");
				if (tid == options.threadID) {
					$(this).remove();
				}
			});
			
			msgCont.data("threadID", options.threadID);
		}
		
		// Hide messages which are not important
		this.#messageElement.children().each(function(el) {
			var flag = $(this).data("alwaysHideAtNewMessage");
			if (flag) {
				$(this).remove();
			}
		});
		
		if (options.alwaysHideAtNewMessage) {
			msgCont.data("alwaysHideAtNewMessage", true);
		}
	}
}