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
class Triggers {  
	
	#app = null;
	#createDialog = null;
	#imageDialog = null;
	#downloadDialog = null;
		
	constructor(app) {
		this.#app = app;
		
		this.#createDialog = new CreateDialog(this.#app);
		this.#imageDialog = new ImageDialog(this.#app);
		this.#downloadDialog = new DownloadDialog(this.#app);
	}
	
	/**
	 * Download document dialog.
	 */
	async triggerDownloadDocument(id) {
		var doc = this.#app.data.getById(id);
		if (!doc) throw new Error('Document ' + id + ' not found');

		var props = await this.#downloadDialog.show('Download options for ' + doc.name);
		if (!props) throw new InfoError('Action canceled');
		
		return await this.#app.actions.document.downloadDocument(id, props); 
		
		
	}
	
	/**
	 * After confirmation, the complete notebook will be exported.
	 */
	async triggerExport(exporter) {
		if (!(exporter instanceof Exporter)) throw new Error('Invalid exporter');
		
		if (!confirm('Export all documents?')) throw new InfoError('Action canceled');
		
		var data = await this.#app.actions.data.exportNotebook(exporter, null);
		
		this.#app.view.message(data.message ? data.message : 'Export finished successfully.', 'S');
		
		return { ok: true };
	}
	
	/**
	 * Ask the user for a file and start the import.
	 */
	async triggerImport(importer) {
		if (!(importer instanceof Importer)) throw new Error('Invalid importer');

		var options = importer.getOptionDefinitions();

		var optionsUi = new ImportOptions(options);

		var files = await this.#app.view.getDialog().promptFiles('Import data from file:', {
			content: optionsUi.content
		}); 
		if (!files) throw new InfoError('Action canceled');

		var file = files[0];
		if (!file) throw new Error('No file returned');
    	
    	importer.setOptions(optionsUi.getOptions());
    	
		console.log('File Import: Loading ' + file.name, 'I');
			
		this.#app.routing.callConsole();
		
		var that = this;
		setTimeout(function() {
			that.#app.actions.data.importFile(file, importer)
			.catch(function(err) {
				that.#app.errorHandler.handle(err);
			});
		}, 200);  // TODO Find better solution than setTimout for this!
	}
	
	/**
	 * Shows a dialog to open any document by selecting from a list.
	 */
	async triggerSelectDocument() {
		var target = await this.#app.view.dialogs.promptSelectDocument('Open Document:', {
			excludeRoot: true,
			submitOnChange: true
		})
		
		if (!target) return;
		this.#app.routing.call(target);
		
		return { ok: true };
	}

	/**
	 * Ask the user where to create a reference to id, and create it.
	 */
	async triggerCreateReference(id) {
		var doc = this.#app.data.getById(id);
		if (!doc) throw new Error('Document ' + id + ' not found');
		
		var target = await this.#app.view.dialogs.promptSelectDocument('Create reference to ' + doc.name + ' in: ', {
			excludeIds: [id],
			excludeTypes: ['reference'],
			defaultTargetId: doc.parent
		})
		
		var data = await this.#app.actions.reference.createReference(id, target);
		
		this.#app.view.message(data.message ? data.message : 'Successfully created new reference', 'S');
		
		return { ok: true };
	}

	/**
	 * Ask the user for a new target for a reference document, and
	 * sets the new target.
	 */
	async triggerSetReference(id) {
		var doc = this.#app.data.getById(id);
		if (!doc) throw new Error('Document ' + id + ' not found');
		if (doc.type != 'reference') throw new Error('Document ' + id + ' is no reference');
		
		var target = await this.#app.view.dialogs.promptSelectDocument('Point ' + doc.name + ' to:', {
			excludeIds: [id, doc.ref],
			excludeTypes: ['reference'],
			defaultTargetId: doc.ref
		})
		
		var data = await this.#app.actions.reference.setReference(id, target);
		
		this.#app.view.message(data.message ? data.message : 'Successfully set new reference target', 'S');
		
		return { ok: true };
	}
	
	/**
	 * Ask the user for a background image and sets it on an item.
	 */
	async triggerSetItemBackgroundImage(ids) {
		ids = Tools.removeDuplicates(ids);
		if (ids.length == 0) throw new WarningError('No documents passed');
		
		var docs = [];
		for(var i in ids) {
			var doc = this.#app.data.getById(ids[i]);
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

		await this.#app.actions.document.saveItemBackgroundImage(ids, backImage);
		
		this.#app.view.message('Updated background image for ' + displayName, 'S');
		
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
			doc = this.#app.data.getById(ids[i]);
			if (!doc) throw new Error('Document ' + ids[i] + ' not found');
		}

		var displayName = (ids.length == 1) ? doc.name : (ids.length + ' documents');

		var target = await this.#app.view.dialogs.promptSelectDocument('Move ' + displayName + ' to:', {
			excludeIds: ids,
			excludeTypes: ['reference']
		})
		
    	await this.#app.actions.document.moveDocuments(ids, target, true);

   		var tdoc = this.#app.data.getById(target);
    	this.#app.view.message('Moved ' + displayName + ' to ' + (tdoc ? tdoc.name : Config.ROOT_NAME), 'S');
    		
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
		var doc = await this.#app.actions.trash.getTrashedDocument(id);
		if (!doc) throw new Error('Document not found in trash bin');
		
		var all = await this.#app.actions.trash.getTrash();
		
		var undeleteDocs = [];
		this.#filterChildrenOf(id, all.rows, undeleteDocs);
			
		if (undeleteDocs.length > 0) {
			if (!confirm('Also restore the ' + undeleteDocs.length + ' children?')) {
				undeleteDocs = [];
			}
		}
		
		undeleteDocs.push(doc);
		
		var ret = await this.#app.actions.trash.undeleteItems(undeleteDocs);
		
		this.#app.view.message(ret.message ? ret.message : 'Undeleted document successfully.', 'S');
		
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
		var doc = await this.#app.actions.trash.getTrashedDocument(id);
		if (!doc) {
			doc = await this.#app.data.getById(id);
			if (!doc) throw new Error('Document not found');
		}
		
		var revText = "";
		if (rev) revText = " Revision " + rev;
		if (!confirm("Really delete document " + doc.name + revText + " permanently?")) {
			throw new InfoError("Nothing changed.");
		}

		var data = await this.#app.actions.trash.deleteItemPermanently(id, rev);
									
		this.#app.view.message(data.message ? data.message : 'Permanently deleted document ' + doc.name, "S");
		
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
		var doc = this.#app.data.getById(id);
		if (!doc) throw new Erro('Document ' + id + ' not found');
		
		var name = prompt("New name:", doc.name);
		if (!name || name.length == 0) {
			throw new InfoError("Nothing changed.");
		}
		
		return await this.#app.actions.document.copyItem(id, name);
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
			var doc = this.#app.data.getById(ids[i]);
			if (!doc) throw new Error('Document ' + ids[i] + ' not found');
			
			// Unload editor if the item is opened somewhere
			if (this.#app.paging.getCurrentlyShownId() == ids[i]) {
				this.#app.paging.unload();
			}
			
			docs.push(doc);
			++numDocs;

			var docChildren = this.#app.data.getChildren(ids[i], true);
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

		var data = await this.#app.actions.document.deleteItems(docs);

		this.#app.view.message(data.message ? data.message : 'Successfully deleted item(s).', "S");
		
		return data;
	}

	/**
	 * Show the create item dialog and process afterwards.
	 *  
	 * TODO still located right here?
	 */	
	async triggerCreateItem(id) {
		var doc = this.#app.data.getById(id);
		if (!doc && (id.length > 0)) throw new Error('Item ' + id + ' does not exist');
		if ((id.length > 0) && (doc.type == 'reference')) throw new Error('Document ' + doc.name + ' is a reference and cannot have children.');

		var props = await this.#createDialog.show('New document under ' + (doc ? doc.name : Config.ROOT_NAME) + ':');
		if (!props) throw new InfoError('Action canceled');
		
		return await this.#app.actions.document.create(id, props); 
	}
	
	/**
	 * Ask the user for a new name and save the new name.
	 *  
	 * TODO still located right here?
	 */	
	async triggerRenameItem(id) {
		var doc = this.#app.data.getById(id);
		if (!doc) throw new Error('Item ' + id + ' not found');

		var newName = await this.#app.view.dialogs.prompt("New name:", doc.name);
		var data = await this.#app.actions.document.renameItem(id, newName);

		if (data.message) {
			this.#app.view.message(data.message, "S");
		}
		
		return data;
	}
}