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
class View {  
	
	app = null;
	dialogs = null;
	triggers = null;
	
	#messageHandler = null;
		
	constructor(app) {
		this.app = app;
		
		this.#messageHandler = new MessageHandler();
		this.#messageHandler.init();
		
		this.dialogs = new Dialogs(this);
		this.triggers = new Triggers(this.app);
	}
	
	/**
	 * Returns HTML elements for the hashtags of the document.
	 */
	getTagElements(doc, cssClass) {
		var tags = this.app.data.getTags([doc]);
		var ret = [];
		
		var that = this;
		for(var i in tags || []) {
			var col = this.app.hashtag.getColor(tags[i]);

			var el = $('<div data-id="' + (doc ? doc._id : '') + '" data-tag="' + tags[i] + '" data-toggle="tooltip" title="' + Hashtag.startChar + tags[i] + '" class="doc-hashtag ' + (cssClass ? cssClass : '') + '" />')
			.css('background-color', col)
			.on('touchstart mousedown', function(event) {
				event.stopPropagation();
			})
			.on('click', function(event) {
				event.stopPropagation();
				
				const data = $(this).data();
				if (!data || !data.tag) return;
				
				if (event.ctrlKey || event.metaKey) {
					that.app.routing.callHashtags(data.id);
				} else {
					that.app.hashtag.showTag(data.tag);
				}
			})
			
			ret.push(el);
		}
		
		return ret;
	}

	/**
	 * Get a dialog instance.
	 */
	getDialog() {
		return new Dialog(this);
	}
	
	/**
	 * Generates and returns a select element containing elements for all available move targets.
	 * excludeIds will be excluded from the selection, as well as all children of these.
	 */
	getDocumentSelector(excludeIds, excludeRoot) {
		var selector = $('<select class="document-select" />');
		
		var ids = excludeRoot ? [] : [{
			text: '/',
			id: ''
		}];

		var that = this;
		this.app.data.each(function(d) {
			for(var e in excludeIds || []) {
				if (that.app.data.isChildOf(d._id, excludeIds[e])) return;
			}
			
			ids.push({
				text: that.app.data.getReadablePath(d._id),
				id: d._id,
			});
		});
		
		ids.sort(function(a, b) { 
			if (a.text < b.text) return -1;
			if (a.text > b.text) return 1;
			return 0;
		});
		
		for(var i in ids) {
			selector.append(
				$('<option value="' + ids[i].id + '">' + this.formatSelectOptionText(ids[i].text) + '</option>')
			);
		}
		
		return selector;
	}
	
	/**
	 * Formatting of all select options texts.
	 */
	formatSelectOptionText(text) {
		if (!text) return text;
		if (this.app.device.isLayoutMobile() && (text.length > Config.MOBILE_MAX_SELECTOPTION_LENGTH)) {
			return '...' + text.substring(text.length - Config.MOBILE_MAX_SELECTOPTION_LENGTH);
		}
		return text;
	}
	
	/**
	 * Returns a selector element containing all image attachments available
	 */
	getBackgroundImageSelector() {
		var selector = $('<select class="image-attachment-select" />');
		
		var ids = [];

		var that = this;
		this.app.data.each(function(d) {
			if (!Document.isImage(d)) return;
			
			ids.push({
				text: that.app.data.getReadablePath(d._id),
				id: d._id,
			});
		});
		
		ids.sort(function(a, b) { 
			if (a.text < b.text) return -1;
			if (a.text > b.text) return 1;
			return 0;
		});
		
		selector.append(
			$('<option value="_cancel" selected>No Image</option>')
		);

		for(var i in ids) {
			selector.append(
				$('<option value="' + ids[i].id + '">' + this.formatSelectOptionText(ids[i].text) + '</option>')
			);
		}
		
		return selector;
	}
	
	/**
	 * Show a message to the user. Default type is "E" for error, other supported types are I(nfo), W(arning), and S(uccess).
	 * 
	 * options = {
	 *    threadID: false,                   <- If you pass a thread ID, all older messages with the same ID will be removed first.
	 *    alwaysHideAtNewMessage: false,     <- alwaysHideAtNewMessage can be used if you like to have the message disappearing whenever a new one comes in.
	 *    callbackFunction: false            <- callbackFunction is executed on clicking the message.
	 * }
	 */
	message(msg, type, options) {
		this.#messageHandler.message(msg, type, options);
	}
}