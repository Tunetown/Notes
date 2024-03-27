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
	#createDialog = null;
	#imageDialog = null;
		
	constructor(app) {
		this.app = app;
		
		this.#messageHandler = new MessageHandler();
		this.#messageHandler.init();
		
		this.dialogs = new Dialogs(this);
		
		this.#createDialog = new CreateDialog(this.app);
		this.#imageDialog = new ImageDialog(this.app);
	}
	
	/**
	 * Get a dialog instance.
	 */
	getDialog() {
		return new Dialog(this);
	}

	/**
	 * Ask the user for a background image and sets it on an item.
	 */
	async triggerSetItemBackgroundImage(ids) {
		ids = Tools.removeDuplicates(ids);
		if (ids.length == 0) throw new WarningError('No documents passed');
		
		var docs = [];
		for(var i in ids) {
			var doc = this.app.data.getById(ids[i]);
			if (!doc) throw new Error('Document ' + ids[i] + ' not found');
			
			docs.push(doc);
		}

		var displayName = (docs.length == 1) ? docs[0].name : (docs.length + ' documents');
		
		var backImage = await this.#imageDialog.show({ 
			doc: docs[0],
			displayName: displayName,
			imageData: docs[0].backImage,
			maxWidth: Config.ITEM_BACKGROUND_MAX_WIDTH, 
			maxHeight: Config.ITEM_BACKGROUND_MAX_HEIGHT, 
			mimeType: Config.ITEM_BACKGROUND_MIME_TYPE,
			quality: Config.ITEM_BACKGROUND_QUALITY,
			maxBytes: Config.ITEM_BACKGROUND_DONT_RESCALE_BELOW_BYTES
		});

		await this.app.actions.document.saveItemBackgroundImage(ids, backImage);
		
		this.message('Updated background image for ' + displayName, 'S');
		
		return { ok: true };
	}

	/**
	 * Ask the user where to move the passed documents (array of ids),
	 * and triggers the action.
	 * 
	 * TODO still located right here?
	 */
	async triggerMoveItems(ids) {
		ids = Tools.removeDuplicates(ids);
		if (ids.length == 0) throw new WarningError('Nothing to move');

		var doc = null;
		for(var i in ids) {
			doc = this.app.data.getById(ids[i]);
			if (!doc) throw new Error('Document ' + ids[i] + ' not found');
		}

		var displayName = (ids.length == 1) ? doc.name : (ids.length + ' documents');

		var target = await this.dialogs.promptSelectDocument('Move ' + displayName + ' to:', {
			excludeIds: ids,
			excludeTypes: ['reference']
		})
		
    	if (target == "_cancel") throw new InfoError("Action cancelled.")
    	
    	await this.app.actions.document.moveDocuments(ids, target, true);

   		var tdoc = this.app.data.getById(target);
    	this.message('Moved ' + displayName + ' to ' + (tdoc ? tdoc.name : Config.ROOT_NAME), 'S');
    		
		return {
			ok: true
		};
	}

	/**
	 * Ask the user if he wants to undelete also the children, and triggers
	 * undeletion.
	 * 
	 * TODO still located right here?
	 */
	async triggerUndeleteItem(id) {
		var doc = await this.app.actions.trash.getTrashedDocument(id);
		if (!doc) throw new Error('Document not found in trash bin');
		
		var all = await this.app.actions.trash.getTrash();
		
		var undeleteDocs = [];
		this.#filterChildrenOf(id, all.rows, undeleteDocs);
			
		if (undeleteDocs.length > 0) {
			if (!confirm('Also restore the ' + undeleteDocs.length + ' children?')) {
				undeleteDocs = [];
			}
		}
		
		undeleteDocs.push(doc);
		
		var ret = await this.app.actions.trash.undeleteItems(undeleteDocs);
		
		if (ret.message) {
			this.message(ret.message, 'S');
		}
		
		return ret;
	}
	
	/**
	 * Ask the user if he wants to delete the passed document permanently,
	 * and triggers the action.
	 * 
	 * rev can be used optionally to delete a conflict.
	 * 
	 * TODO still located right here?
	 */
	async triggerDeletePermanently(id, rev) {
		var doc = await this.app.actions.trash.getTrashedDocument(id);
		if (!doc) {
			doc = await this.app.data.getById(id);
			if (!doc) throw new Error('Document not found');
		}
		
		var revText = "";
		if (rev) revText = " Revision " + rev;
		if (!confirm("Really delete document " + doc.name + revText + " permanently?")) {
			throw new InfoError("Nothing changed.");
		}

		var data = await this.app.actions.trash.deleteItemPermanently(id, rev);
									
		if (data.message) {
			this.message(data.message, "S");
		}
		
		return data;
	}
	
	/**
	 * Helper for triggerUndeleteItem(). Gets all deep children of id out of the docs 
	 * array and adds them to the ret array.
	 */
	#filterChildrenOf(id, docs, ret) {
		for(var i in docs) {
			if (docs[i].doc.parent == id) {
				ret.push(docs[i].doc);
				
				this.#filterChildrenOf(docs[i].doc._id, docs, ret);
			}
		}
	} 

	/**
	 * Ask the user for a new name and copy the document using this name.
	 * 
	 * TODO still located right here?
	 */
	async triggerCopyItem(id) {
		var doc = this.app.data.getById(id);
		if (!doc) throw new Erro('Document ' + id + ' not found');
		
		var name = prompt("New name:", doc.name);
		if (!name || name.length == 0) {
			throw new InfoError("Nothing changed.");
		}
		
		return await this.app.actions.document.copyItem(id, name);
	}

	/**
	 * Triggers deletion of items, with confirmation.
	 * 
	 * TODO still located right here?
	 */
	async triggerDeleteItem(ids) {
		ids = Tools.removeDuplicates(ids);
		
		var numChildren = 0;
		var numDocs = 0;
		
		var docs = [];

		for(var i in ids) {
			var doc = this.app.data.getById(ids[i]);
			if (!doc) throw new Error('Document ' + ids[i] + ' not found');
			
			// Unload editor if the item is opened somewhere
			if (this.app.paging.getCurrentlyShownId() == ids[i]) {
				this.app.paging.unload();
			}
			
			docs.push(doc);
			++numDocs;

			var docChildren = this.app.data.getChildren(ids[i], true);
			for(var c in docChildren) {
				docs.push(docChildren[c]);
				++numChildren;
			}
		}

		var addstr = numChildren ? (' including ' + numChildren + ' contained items') : '';
		var displayName = (numDocs == 1) ? docs[0].name : (numDocs + ' documents');

		if (!confirm("Really delete " + displayName + addstr + "?")) {
			throw new InfoError("Action canceled.");
		}

		var data = await this.app.actions.document.deleteItems(docs);

		if (data.message) {
			this.message(data.message, "S");
		}
		
		return data;
	}

	/**
	 * Show the create item dialog and process afterwards.
	 *  
	 * TODO still located right here?
	 */	
	async triggerCreateItem(id) {
		var doc = this.app.data.getById(id);
		if (!doc && (id.length > 0)) throw new Error('Item ' + id + ' does not exist');
		if ((id.length > 0) && (doc.type == 'reference')) throw new Error('Document ' + doc.name + ' is a reference and cannot have children.');

		var props = await this.#createDialog.show('New document under ' + (doc ? doc.name : Config.ROOT_NAME) + ':');
		if (!props) throw new InfoError('Action canceled');
		
		return await this.app.actions.document.create(id, props); 
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
		
		return data;
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