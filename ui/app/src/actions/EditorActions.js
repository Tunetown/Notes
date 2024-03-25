/**
 * Actions for editors.
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
class EditorActions {
	
	#app = null;
	#documentAccess = null;
	
	constructor(app, documentAccess) {
		this.#app = app;
		this.#documentAccess = documentAccess;
	}
	
	/**
	 * Opens an appropriate editor for the given document.
	 */
	async requestEditor(doc) {
		if (doc.type == 'reference') {
			this.#app.routing.call(doc.ref);
				
			return {
				ok: true,
				redirected: true
			};
			
		} 
		
		await this.#documentAccess.loadDocuments([doc]);

		// Warnings
		if (doc._conflicts && doc._conflicts.length) {
			this.#app.view.message('There are conflicts with this document, please check the conflicts list.', 'W');
		}
		if (doc.deleted) {
			this.#app.view.message('This document is deleted.', 'W');
		}

		if (doc.type == "attachment") {
			var db = await this.#app.db.get();

			var data = await this.#app.actions.attachment.resolveAttachment(db, doc._id, doc); 

			var url = URL.createObjectURL(data);
				
			await this.#app.loadPage(new AttachmentPage(), { doc: doc, url: url });					

			// Execute callbacks
			this.#app.callbacks.executeCallbacks('openDocument', doc);
				
			return {
				ok: true
			};
		}

		var e = Document.createDocumentEditor(doc);
		await this.#app.loadPage(e, doc);

		// Execute callbacks
		this.#app.callbacks.executeCallbacks('openDocument', doc);
			
		return {
			ok: true
		};
	}
	
	/** 
	 * Saves the note's editor mode to the server.
	 */
	async saveEditorMode(id, editorMode, editorParams) {
		if (!id) throw new Error('No ID passed');
			
		var doc = this.#app.data.getById(id);
		if (!doc) throw new Error('Document ' + id + ' not found');
		
		await this.#documentAccess.loadDocuments([doc]);

		Document.addChangeLogEntry(doc, 'editorModeChanged', {
			from: doc.editor,
			to: editorMode
		});	
			
		doc.editor = editorMode;
		if (editorParams) doc.editorParams = editorParams;
			
		var dataResp = await this.#documentAccess.saveItem(id);
		if (dataResp.abort) {
			return dataResp;
		}
				
		// Execute callbacks
		this.#app.callbacks.executeCallbacks('saveEditorMode', doc);
		
		console.log("Successfully saved " + doc.name);
		
		return {
			ok: true,
			message: "Successfully saved " + doc.name + ".",
		};
	}
}