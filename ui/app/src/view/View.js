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
	#messageHandler = null;
	
	constructor(app) {
		this.app = app;
		
		this.#messageHandler = new MessageHandler();
		this.#messageHandler.init();
		
		this.dialogs = new Dialogs(this);
	}
	
	/**
	 * Get a dialog instance.
	 */
	getDialog() {
		return new Dialog(this);
	}

	/**
	 * Ask the user for a new name and save the new name.
	 *  
	 * TODO still located right here?
	 */	
	async triggerRenameItem(id) {
		var doc = this.app.data.getById(id);
		if (!doc) throw new Error('Item ' + id + ' not found');

		var newName = await this.dialogs.prompt("New name:", doc.name);
		var data = await this.app.actions.document.renameItem(id, newName);

		if (data.message) {
			this.message(data.message, "S");
		}
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