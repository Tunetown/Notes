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
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!EditorActions.instance) EditorActions.instance = new EditorActions();
		return EditorActions.instance;
	}
	
	/**
	 * Opens an appropriate editor for the given document.
	 */
	requestEditor(doc) {
		var n = Notes.getInstance();
		
		if (doc.type == 'reference') {
			Notes.getInstance().routing.call(doc.ref);
				
			return Promise.resolve({
				ok: true,
				redirected: true
			});
		} else 
		if (doc.type == "attachment") {
			var db;
			return DocumentAccess.getInstance().loadDocuments([doc])
			.then(function(/*resp*/) {
				if (doc._conflicts && doc._conflicts.length) {
					n.showAlert('There are conflicts with this document, please check the conflicts list.', 'W', "ConflictWarnings");
				}
				
				if (doc.deleted) {
					n.showAlert('This document is deleted.', 'W', "ConflictWarnings");
				}
				
				return Database.getInstance().get();
			})
			.then(function(dbRef) {
				db = dbRef;
				return AttachmentActions.getInstance().resolveAttachment(db, doc._id, doc); 
			})
			.then(function(data) {
				var url = URL.createObjectURL(data);
				
				var vs = ClientState.getInstance().getViewSettings();
				
				if (vs.useNativePdfViewer) {
					return AttachmentPreview.getInstance().load(doc, url);					
				} else {
					//return AttachmentPreviewJS.getInstance().load(doc, url);
					return AttachmentPreviewPDFium.getInstance().load(doc, url, data);
				}
			})
			.then(function() {
				// Execute callbacks
				Callbacks.getInstance().executeCallbacks('openDocument', doc);
				
				return Promise.resolve({
					ok: true
				});
			});

		} else {
			return DocumentAccess.getInstance().loadDocuments([doc])
			.then(function(/*resp*/) {
				if (doc._conflicts && doc._conflicts.length) {
					n.showAlert('There are conflicts with this document, please check the conflicts list.', 'W', "ConflictWarnings");
				}
				
				if (doc.deleted) {
					n.showAlert('This document is deleted.', 'W', "ConflictWarnings");
				}
				
				var e = Document.getDocumentEditor(doc);
				return e.load(doc);
			})
			.then(function() {
				// Execute callbacks
				Callbacks.getInstance().executeCallbacks('openDocument', doc);
				
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
			
		var n = Notes.getInstance();
		
		var doc = n.getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found',
			messageThreadId: 'SaveEditorModeMessages' 
		});
		
		return DocumentAccess.getInstance().loadDocuments([doc])
		.then(function(/*resp*/) {
			Document.addChangeLogEntry(doc, 'editorModeChanged', {
				from: doc.editor,
				to: editorMode
			});	
			
			doc.editor = editorMode;
			if (editorParams) doc.editorParams = editorParams;
			
			return DocumentAccess.getInstance().saveItem(id);
		})
		.then(function(dataResp) {
			if (!dataResp.abort) {
				// Execute callbacks
				Callbacks.getInstance().executeCallbacks('saveEditorMode', doc);
				
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