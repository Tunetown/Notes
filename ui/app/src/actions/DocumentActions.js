/**
 * Actions for documents.
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
class DocumentActions {
	
	#app = null;
	#documentAccess = null;
	
	#imageDialog = null;
	#createDialog = null;
	
	constructor(app, documentAccess) {
		this.#app = app;
		this.#documentAccess = documentAccess;
		
		this.#imageDialog = new ImageDialog(this.#app);
		this.#createDialog = new CreateDialog(this.#app); // TODO
	}
	
	/**
	 * Request the content of a new note and set the editor accordingly.
	 */
	async request(id) {
		if (!id) throw new Error('No id passed');
		
		var db = await this.#app.db.get();

		var doc;
		
		try {
			doc = await db.get(id, { 
				conflicts: true 
			});
			
		} catch (err) {
			// In case of 404, we give a clear message, all other errors are just passed
			if (err.status == 404) throw new Error('Document ' + id + ' not found');
			
			throw err;
		}

		if (doc.type == "reference") {
			if (!doc.ref) throw new Error('Error in reference: no target ID exists.');
			
			this.#app.routing.call(doc.ref);
			
			return {
				ok: true,
				redirected: true
			};

		} else if (doc.type != "attachment") {
			// Create dummy editor to get the properties
			var e = Document.createDocumentEditor(doc);  
			if (!e) {
				throw new Error('No editor found for document type ' + data.type);
			}				
			
			if (e.needsHierarchyData()) {
				if (!this.#app.data) {
					await this.#app.actions.nav.requestTree();
				}
			}
		}

		// Update data model
		if (this.#app.data) {
			var docPers = this.#app.data.getById(id);
			if (docPers) {
				Document.update(docPers, doc);
				Document.setLoaded(docPers);
			}
			
			if (doc.type == 'reference') {
				var docPersTarget = this.#app.data.getById(doc.ref);
				if (docPersTarget) {
					Document.update(docPersTarget, data);
					Document.setLoaded(docPersTarget);
				}
			}
		}

		var docs = [doc];
		var targetDoc = doc;
		
		// Execute callbacks
		this.#app.callbacks.executeCallbacks('loadDocument', docs);

			// Open document in editor
		await this.#app.actions.editor.requestEditor(targetDoc);
		
		return { ok: true };
	}
	
	/**
	 * Request to view a note conflict revision.
	 */
	async requestConflict(id, rev) {
		var db = await this.#app.db.get();
		var docCurrent = await db.get(id);
		var docConflict = await db.get(id, {
			rev: rev
		});

		await this.#app.loadPage(new ConflictPage(), {
			docConflict: docConflict, 
			docCurrent: docCurrent
		});
			
		// Execute callbacks
		this.#app.callbacks.executeCallbacks('requestConflict', {
			docConflict: docConflict,
			docCurrent: docCurrent
		});

		return { ok: true };
	}
	
	/**
	 * Request the raw JSON view for the document.
	 */
	async requestRawView(id) {
		var db = await this.#app.db.get();
		var data = await db.get(id);
			
		await this.#app.loadPage(new RawPage(), data);
			
		return { ok: true };
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	/**
	 * Creates one or more documents (in case of attachments multiple selection) in the passed parent ID.
	 */
	async create(id) {
		var doc = this.#app.data.getById(id);
		if (!doc && (id.length > 0)) throw new Error('Item ' + id + ' does not exist');
		if ((id.length > 0) && (doc.type == 'reference')) throw new Error('Document ' + doc.name + ' is a reference and cannot have children.');

// TODO move out of here
		var answer = await this.#createDialog.show('New document under ' + (doc ? doc.name : Config.ROOT_NAME) + ':');
		if (!answer) throw new InfoError('Action canceled');

		var db = await this.#app.db.get();
			
		var docs = [];

		if (answer.type == 'attachment') {
			for(var f=0; f<answer.files.length; ++f) {   // NOTE: No shorter form possible because of the type files has. Must be that way ;)
				var file = answer.files[f];
				var strippedName = Document.stripAttachmentName(file.name);
				
			    var data = {
					_id: this.#app.data.generateIdFrom(file.name),
					type: "attachment",
					name: file.name,
					parent: id,
					order: 0,
					timestamp: file.lastModified,
					content_type: file.type,
					attachment_filename: strippedName,
					attachmentSize: file.size,          // Set here because the attachment has no length attribute yet.
					_attachments: {}
				};
			    
			    data._attachments['attachment_data'] = {
					content_type: file.type,
	    			data: file,
					length: file.size
				};
			    
				Document.updateMeta(data);
				
				docs.push(data);
			}
			
		} else {
			var data = {
				_id: this.#app.data.generateIdFrom(answer.name),
				type: answer.type,
				name: answer.name,
				parent: id,
				order: 0,
				timestamp: Date.now(),
			};
			
			if (answer.type == 'reference') {
				data.ref = answer.refTarget;
			} else {
				data.editor = this.#app.settings.settings.defaultNoteEditor;
				data.content = "";
				
				if ((data.editor == 'code') && this.#app.settings.settings.defaultCodeLanguage) {
					data.editorParams = {
						language: this.#app.settings.settings.defaultCodeLanguage
					}
				}
			}
		
			Document.addChangeLogEntry(data, 'created', {
				parent: id
			});
			
			Document.updateMeta(data);
			
			docs.push(data);
		}
			
		var data = await db.bulkDocs(docs);

		var newIds = [];
		for(var d in data) {
			if (!data[d].ok) throw new Error(data[d].message);
			
			newIds.push(data[d].id);
		}
		
		var dataAll = await db.allDocs({
			conflicts: true,
			include_docs: true,
			keys: newIds
		});
		
		// Asynchronously request the document, if the parent is not part of a kanban board
		if (dataAll.rows.length == 1) {
			var doc = dataAll.rows[0].doc;
		}
			
		for(var d in dataAll.rows) {
			var doc = dataAll.rows[d].doc;
			
			// Update data model
			this.#app.data.add(doc);
		}
		
		// Execute callbacks
		this.#app.callbacks.executeCallbacks('create', newIds);
		
		return {
			ok: true,
			message: 'Successfully created ' + newIds.length + ' document(s)',
			newIds: newIds
		};
	}
	
	/**
	 * Saves the current note content to the server, creating a new version of it.
	 */
	save(id, content) { 
		if (!id) return Promise.reject({ 
			message: 'No ID passed',
		});
			
		var data = this.#app.data.getById(id);
		if (!data) {
			return Promise.reject({
				message: 'Document ' + id + ' not found',
			});
		}
		
		var reloadTree = false;

		var that = this;
		return this.#documentAccess.loadDocuments([data])
		.then(function(/*resp*/) {
			if (Document.getContent(data) == content) {
				that.#app.paging.resetEditorDirtyState();
				
				return Promise.reject({ 
					abort: true,
					message: "Nothing changed.",
				});
			}
			
			// Create version
			var versionName = false;
			if (Document.getContent(data)) {
				if (!data.timestamp) data.timestamp = 0;
				if (!Document.getAttachments(data)) data._attachments = {};

				versionName = "version_" + data.timestamp;
				data._attachments[versionName] = {
					content_type: "text/html",
					data: new Blob([Document.getContent(data)], {
					    type: 'text/html'
					})
				};
				data._attachments[versionName].length = data._attachments[versionName].data.size;
			}
			
			// Reduce old versions
			var deletedVersions = [];
			if (that.#app.settings.settings.reduceHistory) {
				deletedVersions = Document.reduceVersions(data);
			} else {
				console.log(" -> Versioning: WARNING: History Reduction is disabled");
			}
			
			// Set new content
			data.content = content;
			data.timestamp = Date.now();

			// Change log entry
			var chgData = {};
			if (versionName) chgData.versionCreated = versionName;
			if (deletedVersions.length) chgData.deletedVersions = deletedVersions;
			Document.addChangeLogEntry(data, 'edited', chgData);

			// Check if we have to reload the tree because of metadata changes
			var brokenLinkErrors = [];
			Document.checkLinkages(data, null, brokenLinkErrors, true);
			Document.checkTags(data, null, brokenLinkErrors);
			reloadTree = (brokenLinkErrors.length > 0);
			
			return that.#documentAccess.saveItem(id, true);
		})
		.then(function (dataResp) {
			if (!dataResp.abort) {
				// Update editor state / changed marker
				/*if (e) {
					e.loadDocument(data);				
				}*/
				that.#app.paging.setPageData(data);
				that.#app.update();
				
				// Execute callbacks
				that.#app.callbacks.executeCallbacks('save', data);
				
				console.log("Successfully saved " + data.name);
				
				if (reloadTree) {
					console.log("Save: -> Re-requesting tree, document " + (data.name ? data.name : data._id) + " had relevant changes");
					
					return that.#app.actions.nav.requestTree()
					.then(function() {
						return Promise.resolve({ 
							ok: true,
							message: "Successfully saved " + data.name + ".",
							messageThreadId: "SaveMessages",
							treeReloaded: true
						});
					});
				} else {
					// Update sorting
					that.#app.nav.updateSort();
				}
				
				return Promise.resolve({ 
					ok: true,
					message: "Successfully saved " + data.name + ".",
				});
			} else {
				that.#app.paging.resetEditorDirtyState();
				
				return Promise.resolve(dataResp);
			}
		});
	}
		
	/**
	 * Delete notes by IDs. This does not delete but just set a deleted flag. 
	 * You have to call deleteItemPermanently to fully delete a note.
	 */
	deleteItems(ids, noConfirm) {
		// Collect docs and children
		var docs = [];
		var children = [];
		for(var i in ids) {
			var doc = this.#app.data.getById(ids[i]);
			if (!doc) return Promise.reject({ 
				message: 'Document ' + ids[i] + ' not found',
			});
			docs.push(doc);

			// Unload editor if the item is opened somewhere
			if (this.#app.paging.getCurrentlyShownId() == ids[i]) {
				this.#app.paging.unload();
			}
			
			var docChildren = this.#app.data.getChildren(ids[i], true);
			for(var c in docChildren) {
				children.push(docChildren[c]);
			}
		}
		
		// Check references
		var containedRefs = [];
		
		function addContainedRef(refDoc) {
			for(var i in docs) {
				if (docs[i]._id == refDoc._id) {
					return;
				}
			}
			for(var i in children) {
				if (children[i]._id == refDoc._id) {
					return;
				}
			}
			containedRefs.push(refDoc);
		}
		
		for(var i in docs) {
			var doc = docs[i];
			var crefs = this.#app.data.getReferencesTo(doc._id);
			for(var o in crefs || []) {
				addContainedRef(crefs[o]);
			}
		}

		for(var c in children) {
			var crefs = this.#app.data.getReferencesTo(children[c]._id);
			for(var o in crefs || []) {
				addContainedRef(crefs[o]);
			}
		}

		if (containedRefs.length) { 
			var str = '';
			for(var o in containedRefs) {
				str += this.#app.data.getReadablePath(containedRefs[o]._id) + '\n';
			}
			
			return Promise.reject({
				message: 'The following references still point to the item(s) to be deleted, please delete them first: <br><br>' + str,
				messageThreadId: 'DeleteMessages'
			});
		}
		
		var addstr = children.length ? (' including ' + children.length + ' contained items') : '';
		var displayName = (docs.length == 1) ? docs[0].name : (docs.length + ' documents');
		
		if (!noConfirm) {
			if (!confirm("Really delete " + displayName + addstr + "?")) {
				return Promise.reject({
					abort: true,
					message: "Action canceled.",
					messageThreadId: 'DeleteMessages'
				});
			}
		}
		
		// Merge all documents into docs
		for (var l in children) {
			docs.push(children[l]);
		}
		
		var that = this;
		return this.#documentAccess.loadDocuments(docs)
		.then(function(/*resp*/) {
			var ids = [];
			for(var d in docs) {
				var doc = docs[d];
				doc.deleted = true;
				Document.addChangeLogEntry(doc, 'deleted');
				console.log('Deleting ' + that.#app.data.getReadablePath(doc._id));
				ids.push(doc._id);
			}
			
			return that.#documentAccess.saveItems(ids);
		})
		.then(function (/*data*/) {
			// Execute callbacks
			that.#app.callbacks.executeCallbacks('delete', docs);

			return Promise.resolve({
				ok: true,
				message: "Successfully trashed " + displayName + ".",
				messageThreadId: 'DeleteMessages'
			});
		});
	}
		
	/**
	 * Rename items in general.
	 */
	async renameItem(id, newName) {
		var doc = this.#app.data.getById(id);
		if (!doc) throw new Error('Item ' + id + ' not found');
		if (!newName || newName.length == 0 || newName == doc.name) throw new InfoError("Nothing changed.");

		await this.#documentAccess.loadDocuments([doc])

		Document.addChangeLogEntry(doc, 'renamed', {
			from: doc.name,
			to: newName
		});
		doc.name = newName;
				
		await this.#documentAccess.saveItem(id);

		// Execute callbacks
		this.#app.callbacks.executeCallbacks('rename', doc);
			
		return {
			ok: true,
			message: "Successfully renamed item."
		};
	}
	
	/**
	 * Copy the given document.
	 */
	copyItem(id) {
		if (!id) return Promise.reject({
			message: 'No id passed',
			messageThreadId: 'CopyMessages'
		});
		
		var doc = this.#app.data.getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found',
			messageThreadId: 'CopyMessages'
		});
		
		this.#app.data.resetBacklinks();
		this.#app.data.resetChildrenBuffers();
		
		var db;
		var newDoc;
		var that = this;
		return this.#documentAccess.loadDocuments([doc])
		.then(function(/*resp*/) {
			return that.#app.db.get();
		})
		.then(function(dbRef) {
			db = dbRef;

			if (doc.type == "attachment") {
				return Promise.reject({
					message: 'Attachments cannot be copied.',
				});
			}
			
			var name = prompt("New name:", doc.name);
			if (!name || name.length == 0) {
				return Promise.reject({
					abort: true,
					message: "Nothing changed.",
				});
			}
			
			// Create a new note with the content of the original.
			newDoc = {
				_id: that.#app.data.generateIdFrom(name),
				type: doc.type,
				name: name,
				parent: doc.parent,
				order: doc.order,
				navRelations: doc.navRelations,
				ref: doc.ref,
				timestamp: Date.now(),
				content: Document.getContent(doc)
			};
			
			Document.addChangeLogEntry(newDoc, 'created', {
				original: doc._id,
				parent: doc.parent
			});
			
			Document.updateMeta(newDoc);
			
			return db.put(newDoc);
		})
		.then(function(data) {
			newDoc._rev = data.rev;
			that.#app.data.add(newDoc);
			
			// Execute callbacks
    		that.#app.callbacks.executeCallbacks('copy', newDoc);
    		
			return that.request(newDoc._id);
		})
		.catch(function(err) {
			Document.unlock(id);
			return Promise.reject(err);
		});
	}

	/**
	 * Move an item, showing a popup to select the target ID. Calls moveDocument when 
	 * all data is gathered.
	 */
	moveItems(ids) {
		var docs = [];
		
		ids = Tools.removeDuplicates(ids);
		
		for(var i in ids) {
			var doc = this.#app.data.getById(ids[i]);
			if (!doc) return Promise.reject({
				message: 'Document ' + ids[i] + ' not found',
				messageThreadId: 'MoveMessages'
			});
			
			docs.push(doc);
		}

		if (ids.length == 0) return Promise.reject({
			message: 'Nothing to move',
			messageThreadId: 'MoveMessages'
		});
		
		var displayName = (docs.length == 1) ? docs[0].name : (docs.length + ' documents');

		var existingRefs = [];
		for(var i in ids) {
			existingRefs.push(ids[i]);
		}
		this.#app.data.each(function(doc) {
			if (doc.type == 'reference') existingRefs.push(doc._id);
		});
		
		var selector = this.#app.view.getDocumentSelector(existingRefs);
		selector.val(docs[0].parent);
		selector.css('max-width', '100%');
		
		$('#moveTargetSelectorList').empty();
		$('#moveTargetSelectorList').append(selector);

		// Enable searching by text entry
		selector.selectize({
			sortField: 'text'
		});
		
		$('#moveSubmitButton').html('Move');
		
		var that = this;
		return new Promise(function(resolve, reject) {
			$('#moveSubmitButton').off('click');
			$('#moveSubmitButton').on('click', function(/*event*/) {
				$('#moveTargetSelector').off('hidden.bs.modal');
	        	$('#moveTargetSelector').modal('hide');
	        	var target = selector.val();
	        	if (target == "_cancel") {
	        		reject({
	        			abort: true,
						message: "Action cancelled.",
						messageThreadId: 'MoveMessages'
					});
	        		return;
	        	}
	        	
	        	that.moveDocuments(ids, target, true)
	        	.then(function(/*data*/) {
	        		var tdoc = this.#app.data.getById(target);
	        		
					resolve({
						ok: true,
						message: 'Moved ' + displayName + ' to ' + (tdoc ? tdoc.name : Config.ROOT_NAME),
						messageThreadId: 'MoveMessages'
					});
	        	})
	        	.catch(function(err) {
	        		reject({
						message: "Error moving document(s): " + err.message,
						messageThreadId: 'MoveMessages'
					});
	        	});
			});
			
			$('#moveTargetSelector').off('hidden.bs.modal');
			$('#moveTargetSelector').on('hidden.bs.modal', function () {
				reject({
					abort: true,
					message: 'Action cancelled.',
					messageThreadId: 'MoveMessages'
				});
			});
			
			$('#moveTargetSelectorText').text('Move ' + displayName + ' to:');
			$('#moveTargetSelector').modal();
		});
	}
	
	/**
	 * Move a document in the place of another node in the tree. 
	 * With moveToSubOfTarget you control if the note shall be moved as a subnode of target (true) or beneath the target (false).
	 */
	moveDocuments(ids, targetId, moveToSubOfTarget) {
		var docTarget = this.#app.data.getById(targetId);
		if (docTarget.type == 'reference') {
			return Promise.reject({
				message: 'Cannot move into references.',
				messageThreadId: 'MoveMessages'
			});
		}
		
		var docsInvolved = [docTarget];

		var docsSrc = [];
    	for(var i in ids) {
    		var doc = this.#app.data.getById(ids[i]);
    		if (!doc) {
    			return Promise.reject({
    				message: 'Document ' + ids[i] + ' not found',
					messageThreadId: 'MoveMessages'
    			});
    		}
    		docsSrc.push(doc);
    		docsInvolved.push(doc);
    	}
    	
    	var parentsChildren;
    	if (!targetId || moveToSubOfTarget) {
    		parentsChildren = this.#app.data.getChildren(targetId);
    	} else {
    		parentsChildren = this.#app.data.getChildren(docTarget.parent);
    	}
    	
    	for(var i in parentsChildren) {
    		docsInvolved.push(parentsChildren[i]);
    	}
    	
    	if (!moveToSubOfTarget) {
			for(var s in docsSrc) {
	    		var siblings = this.#app.nav.reorderVisibleSiblings(docsSrc[s], true);
	    		
	    		for(var i in siblings) {
					var sibling = this.#app.data.getById(siblings[i]);
		    		if (!sibling) {
		    			return Promise.reject({
		    				message: 'Document ' + siblings[i] + ' not found',
							messageThreadId: 'MoveMessages'
		    			});
		    		}
	    			docsInvolved.push(sibling);
	    		}
	    	}
    	}

    	var updateIds = [];
    	var that = this;
    	return this.#documentAccess.loadDocuments(docsInvolved)
    	.then(function(/*resp*/) {
	    	if (!targetId || moveToSubOfTarget) {
	    		for(var s in docsSrc) {
	    			if (docsSrc[s].parent != targetId) {
	    				Document.addChangeLogEntry(docsSrc[s], 'parentChanged', {
	    					from: docsSrc[s].parent,
	    					to: targetId
	    				});
	    				
	    				that.#app.data.setParent(docsSrc[s]._id, targetId);
	    				updateIds.push(docsSrc[s]._id);
	    			}
	    		}
	    	} else {
	    		for(var s in docsSrc) {
		    		if (docsSrc[s].parent != docTarget.parent) {
		    			Document.addChangeLogEntry(docsSrc[s], 'parentChanged', {
		    				from: docsSrc[s].parent,
		    				to: docTarget.parent
		    			});
		    			
		    			that.#app.data.setParent(docsSrc[s]._id, docTarget.parent);
		    			updateIds.push(docsSrc[s]._id);
		    		}
	    		}
	    	}
	
	    	for(var s in docsSrc) {
	    		console.log("Moving item " + docsSrc[s].name + (moveToSubOfTarget ? " into " : " beneath ") + (docTarget ? docTarget.name : "Root"));
	    	
		    	// In case of staying in the same parent, re-oder the children of the new parent accordingly. 
		    	// We just take the order of items the grid gives us, and even when the items might not all be there, this makes sense as it
		    	// always resembles the order the user sees (if he sees any).
		    	if (!moveToSubOfTarget) {
		    		var ouIds = that.#app.nav.reorderVisibleSiblings(docsSrc[s]);
		    		for(var i in ouIds) {
		    			updateIds.push(ouIds[i]);
		    		}
		    	}
	    	}
			
			// Execute callbacks
			that.#app.callbacks.executeCallbacks('moveDocumentBeforeSave', {
				docsSrc: docsSrc,
				docTarget: docTarget,
				moveToSubOfTarget: moveToSubOfTarget,
				updateIds: updateIds
			});
			
	    	// Save the new tree structure by updating the metadata of all touched objects.
	    	return that.#documentAccess.saveItems(updateIds);
    	})
    	.then(function(/*data*/) {
    		// Execute callbacks
    		that.#app.callbacks.executeCallbacks('moveDocumentAfterSave', {
    			docsSrc: docsSrc,
    			docTarget: docTarget,
    			moveToSubOfTarget: moveToSubOfTarget,
    			updateIds: updateIds
    		});
    		
    		return Promise.resolve({ ok: true });
    	})
    	.then(function(/*data*/) {
    		t.unblock();

    		return Promise.resolve({ ok: true });
    	});
	}
	
	/**
	 * Saves the order of items for the passed parent as visible in navigation, without changing anything else
	 */
	saveChildOrders(id) {
		var doc = this.#app.data.getById(id);

		var docsInvolved = [doc];
		var siblings = this.#app.nav.reorderVisibleSiblings(doc, true);
		for(var i in siblings) {
			var sibling = this.#app.data.getById(siblings[i]);
    		if (!sibling) {
    			return Promise.reject({
    				message: 'Document ' + siblings[i] + ' not found',
					messageThreadId: 'MoveMessages'
    			});
    		}
			docsInvolved.push(sibling);
		}

    	var updateIds = [];
    	
    	var that = this;
    	return this.#documentAccess.loadDocuments(docsInvolved)
    	.then(function(/*resp*/) {
    		var ouIds = that.#app.nav.reorderVisibleSiblings(doc);
    		for(var i in ouIds) {
    			updateIds.push(ouIds[i]);
	    	}
			
			that.#app.callbacks.executeCallbacks('reorderDocumentsBeforeSave', {
				updateIds: updateIds
			});
			
	    	// Save the new tree structure by updating the metadata of all touched objects.
	    	return that.#documentAccess.saveItems(updateIds);
    	})
    	.then(function(/*data*/) {
    		// Execute callbacks
    		that.#app.callbacks.executeCallbacks('reorderDocumentsAfterSave', {
    			updateIds: updateIds
    		});
    		
    		return Promise.resolve({ ok: true });
    	})
    	.then(function(/*data*/) {
    		t.unblock();

    		return Promise.resolve({ ok: true });
    	});
	}
	
	/**
	 * Sets the star flag of an item.
	 */
	async setStarFlag(id, flagActive) {
		var doc = this.#app.data.getById(id);
		if (!doc) throw new Error('Item ' + id + ' not found');
		
		if (doc.star == !!flagActive) {
			return {
				ok: true,
				nothingChanged: true
			};
		}
		
		await this.#documentAccess.loadDocuments([doc]);

		doc.star = !!flagActive;
				
		await that.#documentAccess.saveItem(id)

		// Execute callbacks
		this.#app.callbacks.executeCallbacks('setStar', doc);
			
		return {
			ok: true,
		};
	}
	
	/**
	 * Delete whole change log of a note
	 */
	deleteChangeLog(id) {
		var db;
		
		return this.#app.db.get()
		.then(function(dbRef) {
			db = dbRef;
			Document.lock(id);
			
			return db.get(id);
		})
		.then(function (data) {
			var oldLen = data.changeLog.length;
			data.changeLog = [];

			Document.addChangeLogEntry(data, 'deletedChangeLog', {
				numDeleted: oldLen
			});

			Document.updateMeta(data);
			
			return db.put(data);
		})
		.then(function (data) {
			if (!data.ok) {
				Document.unlock(id);
				
				return Promise.reject({
					message: data.message,
					messageThreadId: 'DeleteChangeLogMessages'
				});
			}

			Document.unlock(id);
			
			return Promise.resolve({
				ok: true
			});
		})
		.catch(function(err) {
			Document.unlock(id);
			
			return Promise.reject(err);
		});
	}

	/**
	 * Restore the ghost version (id) with the new ID newId.
	 */
	undeleteItem(id) {
		var db;
		
		this.#app.data.resetBacklinks();
		this.#app.data.resetChildrenBuffers();
		
		var doc = null;
		var that = this;
		return this.#app.db.get()
		.then(function(dbRef) {
			db = dbRef;
			return db.query(that.#app.views.getViewDocId() + '/deleted', {
				include_docs: true
			});
		})
		.then(function (data) {
			if (!data.rows) return Promise.reject({
				message: 'No documents to undelete',
				messageThreadId: 'UndeleteMessages'
			});
			
			var undeleteDocs = [];
			that.filterChildrenOf(id, data.rows, undeleteDocs);
			
			if (undeleteDocs.length > 0) {
				if (!confirm('Also restore the ' + undeleteDocs.length + ' children?')) {
					undeleteDocs = [];
				}
			}
			
			for(var i in data.rows) {
				if (!data.rows[i].doc.deleted) continue;
				
				if (data.rows[i].doc._id == id) {
					doc = data.rows[i].doc;
					break;
				}
			}
			if (!doc) return Promise.reject({
				message: 'Document ' + id + ' seems not to be deleted.',
				messageThreadId: 'UndeleteMessages'
			});
			
			// Reset parent if not existing anymore
			if (doc.parent && !that.#app.data.getById(doc.parent)) {
				doc.parent = "";
			}
			
			undeleteDocs.push(doc);
			
			for(var i in undeleteDocs) {
				undeleteDocs[i].deleted = false;
				
				Document.addChangeLogEntry(undeleteDocs[i], 'undeleted', {
					parent: undeleteDocs[i].parent,
					causedBy: id
				});
				
				Document.updateMeta(undeleteDocs[i]);
				
				console.log('Undeleting ' + that.#app.data.getReadablePath(undeleteDocs[i]._id));
			}

			return db.bulkDocs(undeleteDocs);
		})
		.then(function (/*data*/) {
			return that.#app.actions.nav.requestTree();
		})
		.then(function (/*data*/) {
			return Promise.resolve({
				ok: true,
				message: "Restored " + doc.name,
				messageThreadId: 'UndeleteMessages'
			});
		});
	}
	
	/**
	 * Helper for undeleteItem(). Gets all deep children if id out of the docs 
	 * array and adds them to the ret array.
	 */
	filterChildrenOf(id, docs, ret) {
		for(var i in docs) {
			if (docs[i].doc.parent == id) {
				ret.push(docs[i].doc);
				
				this.filterChildrenOf(docs[i].doc._id, docs, ret);
			}
		}
	} 
	
	/**
	 * Delete trashed item
	 */
	deleteItemPermanently(id, rev) {
		var db;
		var doc;
		
		this.#app.data.resetBacklinks();
		this.#app.data.resetChildrenBuffers();
		
		var that = this;
		return this.#app.db.get()
		.then(function(dbRef) {
			db = dbRef;
			
			var options = {};
			if (rev) options.rev = rev;
			
			return db.get(id, options);
		})
		.then(function (data) {
			var revText = "";
			if (rev) revText = " Revision " + rev;
			if (!confirm("Really delete " + data.name + revText + "?")) {
				return Promise.reject({
					abort: true,
					message: "Nothing changed.",
					messageThreadId: 'DeletePermMessages'
				});
			}
			doc = data;
			
			return db.remove(data);
		})
		.then(function (dataResp) {
			if (!dataResp.ok) {
				Document.unlock(id);
				return Promise.reject({
					message: dataResp.message,
					messageThreadId: 'DeletePermMessages'
				});
			}
			
			if (rev) {
				that.#app.routing.call(id);
				
				return that.#app.actions.nav.requestTree();
			} else {
				that.#app.resetPage();
				return that.#app.actions.trash.showTrash();
			}
		})
		.then(function (/*dataResp*/) {
			if (rev) {
				return Promise.resolve({
					ok: true,
					message: "Deleted revision " + rev + ".",
					messageThreadId: 'DeletePermMessages'
				});
			} else {
				return Promise.resolve({
					ok: true,
					message: "Permanently deleted " + doc.name + ".",
					messageThreadId: 'DeletePermMessages'
				});
			}
		});
	}
	
	/**
	 * Lets the user choose a background image for the passed documents.
	 */
	setItemBackgroundImage(ids) {
		ids = Tools.removeDuplicates(ids);
		
		var docs = [];
		for(var i in ids) {
			var doc = this.#app.data.getById(ids[i]);
			if (!doc) return Promise.reject({
				message: 'Document ' + ids[i] + ' not found',
				messageThreadId: 'SetItemBgImageMessages'
			});
			
			docs.push(doc);
		}

		if (ids.length == 0) return Promise.reject({
			message: 'Nothing selected',
			messageThreadId: 'SetItemBgImageMessages'
		});
		
		var displayName = (docs.length == 1) ? docs[0].name : (docs.length + ' documents');
		
		var that = this;
		return this.#imageDialog.show({  // TODO move out
			doc: docs[0],
			displayName: displayName,
			imageData: docs[0].backImage,
			maxWidth: Config.ITEM_BACKGROUND_MAX_WIDTH, 
			maxHeight: Config.ITEM_BACKGROUND_MAX_HEIGHT, 
			mimeType: Config.ITEM_BACKGROUND_MIME_TYPE,
			quality: Config.ITEM_BACKGROUND_QUALITY,
			maxBytes: Config.ITEM_BACKGROUND_DONT_RESCALE_BELOW_BYTES
		})
		.then(function(backImage) {
			return that.saveItemBackgroundImage(ids, backImage);
		})			        	
		.then(function(/*data*/) {
			return Promise.resolve({
				ok: true,
				message: 'Updated background image for ' + displayName,
				messageThreadId: 'SetItemBgImageMessages'
			});
    	})
	}
	
	/**
	 * Saves the passed image data to the passed documents.
	 */
	saveItemBackgroundImage(ids, backImage) {
		ids = Tools.removeDuplicates(ids);

		var docsSrc = [];
    	for(var i in ids) {
    		var doc = this.#app.data.getById(ids[i]);
    		if (!doc) {
    			return Promise.reject({
    				message: 'Document ' + ids[i] + ' not found',
					messageThreadId: 'SetItemBgImageMessages'
    			});
    		}
    		docsSrc.push(doc);
    	}
    	
    	var that = this;
    	return this.#documentAccess.loadDocuments(docsSrc)
    	.then(function(resp) {
	    	for(var s in docsSrc) {
	    		docsSrc[s].backImage = backImage;
	
				// Change log entry
				Document.addChangeLogEntry(docsSrc[s], 'backImageChanged', { 
					bytes: JSON.stringify(backImage).length
				});
	    	}
			
			// Execute callbacks
			that.#app.callbacks.executeCallbacks('saveItemBackgroundImageeBeforeSave', {
				docsSrc: docsSrc,
				backImage: backImage
			});
		
	    	// Save the new tree structure by updating the metadata of all touched objects.
	    	return that.#documentAccess.saveItems(ids);
    	})
    	.then(function(/*data*/) {
			return that.#app.actions.nav.requestTree();
		})
    	.then(function(/*data*/) {
    		// Execute callbacks
    		that.#app.callbacks.executeCallbacks('saveItemBackgroundImageAfterSave', {
    			docsSrc: docsSrc,
    			backImage: backImage
    		});
    		
    		return Promise.resolve({ ok: true });
    	})
    	/*.then(function() {
			return that.#app.paging.reloadCurrentPage();  TODO?
		})*/
    	.then(function(/*data*/) {
    		t.unblock();

    		return Promise.resolve({ ok: true });
    	});
	}
	
	/**
	 * For a given document, this loads the background image data (isolated, using a specific DB view) from the database.
	 * Returns a promise with the backImage data for the document.
	 */
	loadItemBackgroundImage(id) {
		var doc = this.#app.data.getById(id);
		if (!doc) {
			return Promise.reject({
				message: 'Document ' + id + ' not found',
				messageThreadId: 'LoadBgImageMessages'
			});
		}
		if (!Document.hasBackImage(doc)) {
			return Promise.reject({
				message: 'Document ' + id + ' has no background image',
				messageThreadId: 'LoadBgImageMessages'
			});
		}
		
		// Check if we already have the image data
		if ((!doc.stub) && (!jQuery.isEmptyObject(doc.backImage)) && (!doc.backImage.stub)) {
			return Promise.resolve(doc.backImage);
		}

		var db;
		var that = this;
		return this.#app.db.get()
		.then(function(dbRef) {
			db = dbRef;
			return db.query(that.#app.views.getViewDocId() + '/bgimage', {
				key: id
			});
		})
		.then(function (data) {
			if (!data.rows || (data.rows.length == 0)) {
				return Promise.reject({
    				message: 'Document ' + id + ' not found',
					messageThreadId: 'LoadBgImageMessages'
    			});
			}
			if (data.rows.length > 1) {
				return Promise.reject({
    				message: 'ID ' + id + ' is not unique: ' + data.rows.length + ' entries found.',
					messageThreadId: 'LoadBgImageMessages'
    			});
			}
			
			var backImage = data.rows[0].value.backImage;
			
			//console.log(' -> Background image data for ' + id + ' loaded (' + Tools.convertFilesize(JSON.stringify(backImage).length) + ')');
			
			// Update data model
			if (that.#app.data) {
				if (doc) {
					doc.backImage = backImage;
					
					Document.update(doc, doc);
				}
			}

			// Execute callbacks
			that.#app.callbacks.executeCallbacks('loadItemBackgroundImage', {
				id: id,
				backImage: backImage
			});
			
			// Return new document
			return Promise.resolve(backImage);
		});
	}
}