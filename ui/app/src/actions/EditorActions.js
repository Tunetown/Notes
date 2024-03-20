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
	requestEditor(doc) {
		var that = this;
		
		if (doc.type == 'reference') {
			this.#app.routing.call(doc.ref);
				
			return Promise.resolve({
				ok: true,
				redirected: true
			});
		} else 
		if (doc.type == "attachment") {
			var db;
			return this.#documentAccess.loadDocuments([doc])
			.then(function(/*resp*/) {
				if (doc._conflicts && doc._conflicts.length) {
					that.#app.showAlert('There are conflicts with this document, please check the conflicts list.', 'W', "ConflictWarnings");
				}
				
				if (doc.deleted) {
					that.#app.showAlert('This document is deleted.', 'W', "ConflictWarnings");
				}
				
				return that.#app.db.get();
			})
			.then(function(dbRef) {
				db = dbRef;
				return that.#app.actions.attachment.resolveAttachment(db, doc._id, doc); 
			})
			.then(function(data) {
				var url = URL.createObjectURL(data);
				
				return that.#app.loadPage(new AttachmentPage(), { doc: doc, url: url });					
			})
			.then(function() {
				// Execute callbacks
				that.#app.callbacks.executeCallbacks('openDocument', doc);
				
				return Promise.resolve({
					ok: true
				});
			});

		} else {
			return this.#documentAccess.loadDocuments([doc])
			.then(function(/*resp*/) {
				if (doc._conflicts && doc._conflicts.length) {
					that.#app.showAlert('There are conflicts with this document, please check the conflicts list.', 'W', "ConflictWarnings");
				}
				
				if (doc.deleted) {
					that.#app.showAlert('This document is deleted.', 'W', "ConflictWarnings");
				}
				
				var e = Document.createDocumentEditor(doc);
				return that.#app.loadPage(e, doc);
			})
			.then(function() {
				// Execute callbacks
				that.#app.callbacks.executeCallbacks('openDocument', doc);
				
				return Promise.resolve({
					ok: true
				});
			});
		}
	}
	
	/** 
	 * Saves the note's editor mode to the server.
	 */
	saveEditorMode(id, editorMode, editorParams) {
		if (!id) return Promise.reject({ 
			message: 'No ID passed',
			messageThreadId: 'SaveEditorModeMessages' 
		});
			
		var doc = this.#app.getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found',
			messageThreadId: 'SaveEditorModeMessages' 
		});
		
		var that = this;
		return this.#documentAccess.loadDocuments([doc])
		.then(function(/*resp*/) {
			Document.addChangeLogEntry(doc, 'editorModeChanged', {
				from: doc.editor,
				to: editorMode
			});	
			
			doc.editor = editorMode;
			if (editorParams) doc.editorParams = editorParams;
			
			return that.#documentAccess.saveItem(id);
		})
		.then(function(dataResp) {
			if (!dataResp.abort) {
				// Execute callbacks
				that.#app.callbacks.executeCallbacks('saveEditorMode', doc);
				
				console.log("Successfully saved " + doc.name);
				
				return Promise.resolve({ 
					ok: true,
					message: "Successfully saved " + doc.name + ".",
					messageThreadId: 'SaveEditorModeMessages' 
				});
			} else {
				return Promise.resolve(dataResp);
			}
		});
	}
}