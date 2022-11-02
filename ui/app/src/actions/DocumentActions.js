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
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!DocumentActions.instance) DocumentActions.instance = new DocumentActions();
		return DocumentActions.instance;
	}
	
	/**
	 * Request the content of a new note and set the editor accordingly.
	 */
	request(id) {
		if (!id) return Promise.reject({
			message: 'No id passed',
			messageThreadId: 'RequestMessages'
		});
		
		var db;
		var doc;

		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			return db.get(id, { 
				conflicts: true 
			});
		})
		.then(function (data) {
			doc = data;

			if (data.type == "attachment") {
				return Promise.resolve({
					ok: true					
				});
			} else if (data.type == "reference") {
				if (!data.ref) return Promise.reject({
					message: 'Error in reference: no target ID exists.',
					messageThreadId: 'RequestMessages'
				});
				
				Notes.getInstance().routing.call(data.ref);
				
				return Promise.resolve({
					ok: true
				});
			} else {
				var e = Document.getDocumentEditor(data);
				if (!e) {
					return Promise.reject({
						message: 'No editor found for document type ' + data.type,
						messageThreadId: 'RequestMessages'
					});
				}
				
				if (e.needsTreeData()) {
					if (!Notes.getInstance().getData()) {
						return TreeActions.getInstance().requestTree();
					} else {
						return Promise.resolve({
							ok: true
						});
					}
				} else {
					return Promise.resolve({
						ok: true
					});
				}
			}
		})
		.then(function (data) {	
			if (doc.type != 'reference') {
				if (!data.ok) {
					return Promise.reject({
						message: data.message,
						messageThreadId: 'RequestMessages'
					});
				}
			} else {
				return Promise.resolve({
					ok: true,
					redirected: true
				});
			}
			
			// Update data model
			if (Notes.getInstance().getData()) {
				var docPers = Notes.getInstance().getData().getById(id);
				if (docPers) {
					Document.update(docPers, doc);
					Document.setLoaded(docPers);
				}
				
				if (doc.type == 'reference') {
					var docPersTarget = Notes.getInstance().getData().getById(doc.ref);
					if (docPersTarget) {
						Document.update(docPersTarget, data);
						Document.setLoaded(docPersTarget);
					}
				}
			}

			var docs = [doc];
			var targetDoc = doc;
			
			// Execute callbacks
			Callbacks.getInstance().executeCallbacks('loadDocument', docs);

			// Open document in editor
			return EditorActions.getInstance().requestEditor(targetDoc); 
		})
		.catch(function(err) {
			if (err.status == 404) {
				return Promise.reject({
					message: 'Document ' + id + ' not found',
					messageThreadId: 'RequestMessages'
				});	
			}
			
			return Promise.reject(err);
		});
	}
	
	/**
	 * Request to view a note conflict revision.
	 */
	requestConflict(id, rev) {
		var db;
		var docCurrent;
		
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			return db.get(id);
		})
		.then(function (docCurrentRef) {
			docCurrent = docCurrentRef;
			return db.get(id, {
				rev: rev
			});
		})
		.then(function (docConflict) {
			Conflict.getInstance().load(docConflict, docCurrent);
			
			// Execute callbacks
    		Callbacks.getInstance().executeCallbacks('requestConflict', {
    			docConflict: docConflict,
    			docCurrent: docCurrent
    		});
		});
	}
	
	/**
	 * Request the raw JSON view for the document.
	 */
	requestRawView(id) {
		return Database.getInstance().get()
		.then(function(db) {
			return db.get(id);
		})
		.then(function (data) {
			var v = RawView.getInstance();
			v.load(data);
			
			return Promise.resolve({ ok: true });
		});		
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	/**
	 * Creates one or more documents (in case of attachments multiple selection) in the passed parent ID.
	 */
	create(id) {
		var n = Notes.getInstance();
		
		var doc = n.getData().getById(id);
		if (!doc && (id.length > 0)) return Promise.reject({
			message: 'Item ' + id + ' does not exist',
			messageThreadId: 'CreateMessages'
		});  
		
		if ((id.length > 0) && (doc.type == 'reference')) return Promise.reject({
			message: 'Document ' + doc.name + ' is a reference and cannot have children.',
			messageThreadId: 'CreateMessages'
		});

		var existingRefs = [];
		n.getData().each(function(doc) {
			if (doc.type == 'reference') existingRefs.push(doc._id);
		});
		
		var refSelector = n.getMoveTargetSelector(existingRefs, true);

		var e = n.getCurrentEditor();
		refSelector.val('');
		
		var typeSelector = Document.getAvailableTypeSelect('createTypeInput');

		n.getData().resetChildrenBuffers();

		var type;
		var name;
		var refTarget;
		var files;
		var newIds = [];
		var docs = [];
		var db;
		return new Promise(function(resolve, reject) {
			$('#selectTypeContainer').empty();
			$('#selectTypeContainer').append(
				typeSelector
				.on('change', function(/*event*/) {
					$('#uploadLabel').css('display', (this.value == "attachment") ? 'inherit' : 'none');
					$('#customFile').css('display', (this.value == "attachment") ? 'inherit' : 'none');
					$('#createNameInput').prop('disabled', (this.value == "attachment"));
					
					$('#refLabel').css('display', (this.value == 'reference') ? 'inherit' : 'none');
					$('#refCell').css('display', (this.value == 'reference') ? 'block' : 'none');
					
					if (e && (this.value == 'reference')) {
						var cur = n.getData().getById(e.getCurrentId());
						if (cur) {
							$('#createNameInput').val(cur.name);
						}
					}
					
					if (this.value == 'attachment') {
						$('#createNameInput').val('');
					}
					
					$('#createNameInput').triggerHandler('input');
				})
			);

			$('#uploadLabel').css('display', 'none');
			$('#customFile').css('display', 'none');
			$('#createNameInput').prop('disabled', false);

			$('#refLabel').css('display', 'none');
			$('#refCell').css('display', 'none');
			$('#refCell').empty();
			$('#refCell').append(
				$('<span class="deprecated"></span>').html('References are deprecated, use in-document links instead'),
				refSelector
				.on('change', function(/*event*/) {
					if ($('#createTypeInput').val() == 'reference') {
						var tdoc = n.getData().getById(this.value);
						if (tdoc) {
							$('#createNameInput').val(tdoc.name);
						}
					}
				})
			);

			// Enable searching by text entry
			refSelector.selectize({
				sortField: 'text'
			});
			
			$('#customFile').val('');
			$('#createNameInput').val('');

			$('#createWarnIcon').css('display', 'none');
			$('#createWarnText').css('display', 'none');
			//$('#createWarnText').html('Name already exists');
			
			$('#createNameInput').off('input');
			$('#createNameInput').on('input', function(/*e*/) {
				// Warning disabled as we can have identical names since long time.
				/*var val = $(this).val();
				
				if ((typeSelector.val() == 'reference') || !val || !val.length) {
					$('#createWarnIcon').css('display', 'none');
					$('#createWarnText').css('display', 'none');
					return;
				}

				if (that.createTimeoutHandler) clearTimeout(that.createTimeoutHandler);
				that.createTimeoutHandler = setTimeout(function() {
					var ex = n.getData().documentNameExists(val);
					$('#createWarnIcon').css('display', ex ? 'inline-block' : 'none');
					$('#createWarnText').css('display', ex ? 'inline-block' : 'none');
				}, 300);*/
			});
			
			$('#newRootText').html(doc ? doc.name : Config.ROOT_NAME);
			
			function createKeyPressed(e) {
			    if(e.which == 13) {
			    	$('#createSubmitButton').click();
			    }
			}
			
			$('#createDialog').off('shown.bs.modal');
			$('#createDialog').on('shown.bs.modal', function (/*e*/) {
				$('#createNameInput').focus();
				$(document).keypress(createKeyPressed);
			});
			$('#createDialog').off('hidden.bs.modal');
			$('#createDialog').on('hidden.bs.modal', function (/*e*/) {
				$(document).unbind('keypress', createKeyPressed);
				reject({
					abort: true,
					message: 'Action canceled.',
					messageThreadId: 'CreateMessages'
				 });
			});
			$('#createDialog').modal();
			
			// Set up submit button
			$('#createSubmitButton').off('click');
			$('#createSubmitButton').on('click', function(e) {
				e.stopPropagation();

				name = $('#createNameInput').val();
				type = $('#createTypeInput').val();
			    
				if (!type) {
					n.showAlert('Please specify a type for the new document.', 'E', 'CreateMessages');
					return;
				}
				
		    	if (type == 'attachment') {
		    		files = $('#customFile')[0].files;
		    		
		    		if (!files || !files.length) {
		    			n.showAlert('Please select a file to upload.', 'E', 'CreateMessages');
						return;
				    }
		    		
		    		var maxMB = parseFloat(Settings.getInstance().settings.maxUploadSizeMB);
		    		if (maxMB) {
			    		for(var f in files) {
				    		if (files[f].size > (maxMB * 1024 * 1024)) {
				    			n.showAlert('The file ' + files[f].name + 'is too large: ' + Tools.convertFilesize(files[f].size) + '. You can change this in the settings.', 'E', 'CreateMessages');
								return;
				    		}
			    		}
		    		}
		    		
		    		if (files && (files.length >= 5)) {
		    			if (!confirm('You are about to upload ' + files.length + ' documents, do you want to proceed?')) {
		    				return;
		    			}
				    }
		    		
		    	} else if (type == 'reference') {
		    		if (!name) {
		    			n.showAlert('Please specify a name for the new document.', 'E', 'CreateMessages');
						return;
				    }
		    		
		    		refTarget = refSelector.val();
		    		
		    		if (!refTarget) {
		    			n.showAlert('Please specify target for the reference document.', 'E', 'CreateMessages');
						return;
		    		}
		    	} else {
		    		if (!name) {
		    			n.showAlert('Please specify a name for the new document.', 'E', 'CreateMessages');
						return;
				    }
		    	}
				
		    	$(document).unbind('keypress', createKeyPressed);
		    	$('#createDialog').off('hidden.bs.modal');
		    	$('#createDialog').modal('hide');
			    
		    	resolve({
		    		ok: true
		    	});
			});
		})
		.then(function(/*data*/) {
			return Database.getInstance().get();
		})
		.then(function(dbRef) {
			db = dbRef;
			
			if (type == 'attachment') {
				for(var f=0; f<files.length; ++f) {   // NOTE: No shorter form possible because of the type files has. Must be that way ;)
					var file = files[f];
					var strippedName = Document.stripAttachmentName(file.name);
					
				    var data = {
						_id: n.getData().generateIdFrom(file.name),
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
					_id: n.getData().generateIdFrom(name),
					type: type,
					name: name,
					parent: id,
					order: 0,
					timestamp: Date.now(),
				};
				
				if (type == 'reference') {
					data.ref = refTarget;
				} else {
					data.editor = Settings.getInstance().settings.defaultNoteEditor;
					data.content = "";
					
					if ((data.editor == 'code') && Settings.getInstance().settings.defaultCodeLanguage) {
						data.editorParams = {
							language: Settings.getInstance().settings.defaultCodeLanguage
						}
					}
				}
			
				Document.addChangeLogEntry(data, 'created', {
					parent: id
				});
				
				Document.updateMeta(data);
				
				docs.push(data);
			}
			
			 return db.bulkDocs(docs);
		})
		.then(function (data) {
			for(var d in data) {
				if (!data[d].ok) {
					return Promise.reject({
						message: 'Error: ' + data[d].message,
						messageThreadId: 'CreateMessages'
					});
				}
				
				newIds.push(data[d].id);
			}
			
			return db.allDocs({
				conflicts: true,
				include_docs: true,
				keys: newIds
			});
		})
		.then(function(data) {
			// Asynchronously request the document, if the parent is not part of a kanban board
			if (data.rows.length == 1) {
				var doc = data.rows[0].doc;
				
				/*if (!Document.isPartOfBoard(doc)) {
					n.routing.call(doc._id);
				}*/
			}
			
			for(var d in data.rows) {
				var doc = data.rows[d].doc;
				
				// Update data model
				n.getData().add(doc);
			}
			
			// Execute callbacks
			Callbacks.getInstance().executeCallbacks('create', newIds);
			
			return Promise.resolve({
				ok: true,
				message: 'Successfully created ' + newIds.length + ' document(s)',
				messageThreadId: 'CreateMessages',
				newIds: newIds
			});
		}); 
	}
	
	/**
	 * Saves the current note content to the server, creating a new version of it.
	 */
	save(id, content) { 
		if (!id) return Promise.reject({ 
			message: 'No ID passed',
			messageThreadId: "SaveMessages"
		});
			
		var n = Notes.getInstance();
		var e = n.getCurrentEditor();
		
		var data = n.getData().getById(id);
		if (!data) {
			return Promise.reject({
				message: 'Document ' + id + ' not found',
				messageThreadId: "SaveMessages"
			});
		}
		
		var reloadTree = false;

		return DocumentAccess.getInstance().loadDocuments([data])
		.then(function(/*resp*/) {
			if (Document.getContent(data) == content) {
				if (e) e.resetDirtyState();
				
				return Promise.reject({ 
					abort: true,
					message: "Nothing changed.",
					messageThreadId: "SaveMessages"
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
			if (Settings.getInstance().settings.reduceHistory) {
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
			reloadTree = (brokenLinkErrors.length > 0);
			
			return DocumentAccess.getInstance().saveItem(id);
		})
		.then(function (dataResp) {
			if (!dataResp.abort) {
				// Update editor state / changed marker
				if (e) {
					e.setCurrent(data);				
					e.resetDirtyState();
				}
				n.update();
				
				// Execute callbacks
				Callbacks.getInstance().executeCallbacks('save', data);
				
				console.log("Successfully saved " + data.name);
				
				if (reloadTree) {
					console.log("Save: -> Re-requesting tree, document " + (data.name ? data.name : data._id) + " had relevant changes");
					
					return TreeActions.getInstance().requestTree()
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
					NoteTree.getInstance().updateSort();
				}
				
				return Promise.resolve({ 
					ok: true,
					message: "Successfully saved " + data.name + ".",
					messageThreadId: "SaveMessages"
				});
			} else {
				if (e) e.resetDirtyState();
				
				return Promise.resolve(dataResp);
			}
		});
	}
		
	/**
	 * Delete notes by IDs. This does not delete but just set a deleted flag. 
	 * You have to call deleteItemPermanently to fully delete a note.
	 */
	deleteItems(ids, noConfirm) {
		var n = Notes.getInstance();
		
		// Collect docs and children
		var docs = [];
		var children = [];
		for(var i in ids) {
			var doc = n.getData().getById(ids[i]);
			if (!doc) return Promise.reject({ 
				message: 'Document ' + ids[i] + ' not found',
				messageThreadId: "DeleteMessages"
			});
			docs.push(doc);

			/*var crefs = n.getData().getReferencesTo(doc._id);
			for(var o in crefs || []) {
				//containedRefs.push(crefs[o]);
				addContainedRef(crefs[o]);
			}*/
			
			// Unload editor if the item is opened somewhere
			var e = Document.getDocumentEditor(doc);
			if (e && (ids[i] == e.getCurrentId())) {
				e.unload();
			}
			
			var docChildren = n.getData().getChildren(ids[i], true);
			for(var c in docChildren) {
				children.push(docChildren[c]);
				
				/*var crefs = n.getData().getReferencesTo(docChildren[c]._id);
				for(var o in crefs || []) {
					addContainedRef(crefs[o]);
					//containedRefs.push(crefs[o]);
				}*/
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
			var crefs = n.getData().getReferencesTo(doc._id);
			for(var o in crefs || []) {
				addContainedRef(crefs[o]);
			}
		}

		for(var c in children) {
			var crefs = n.getData().getReferencesTo(children[c]._id);
			for(var o in crefs || []) {
				addContainedRef(crefs[o]);
				//containedRefs.push(crefs[o]);
			}
		}

		if (containedRefs.length) { 
			var str = '';
			for(var o in containedRefs) {
				str += n.getData().getReadablePath(containedRefs[o]._id) + '\n';
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
		
		return DocumentAccess.getInstance().loadDocuments(docs)
		.then(function(/*resp*/) {
			var ids = [];
			for(var d in docs) {
				var doc = docs[d];
				doc.deleted = true;
				Document.addChangeLogEntry(doc, 'deleted');
				console.log('Deleting ' + n.getData().getReadablePath(doc._id));
				ids.push(doc._id);
			}
			
			return DocumentAccess.getInstance().saveItems(ids);
		})
		.then(function (/*data*/) {
			// Execute callbacks
			Callbacks.getInstance().executeCallbacks('delete', docs);

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
	renameItem(id) {
		var n = Notes.getInstance();
		
		var doc = n.getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Item ' + id + ' not found',
			messageThreadId: 'RenameMessages'
		});
		
		var name = prompt("New name:", doc.name);
		if (!name || name.length == 0) {
			return Promise.reject({
				abort: true,
				message: "Nothing changed.",
				messageThreadId: 'RenameMessages'
			});
		}

		return DocumentAccess.getInstance().loadDocuments([doc])
		.then(function(/*resp*/) {
			Document.addChangeLogEntry(doc, 'renamed', {
				from: doc.name,
				to: name
			});
			doc.name = name;
				
			return DocumentAccess.getInstance().saveItem(id)
		})
		.then(function (/*data*/) {
			// Execute callbacks
			Callbacks.getInstance().executeCallbacks('rename', doc);
			
			return Promise.resolve({
				ok: true,
				message: "Successfully renamed item.",
				messageThreadId: 'RenameMessages'
			});
		});
	}
	
	/**
	 * Copy the given document.
	 */
	copyItem(id) {
		if (!id) return Promise.reject({
			message: 'No id passed',
			messageThreadId: 'CopyMessages'
		});
		
		var n = Notes.getInstance();
		
		var doc = Notes.getInstance().getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found',
			messageThreadId: 'CopyMessages'
		});
		
		n.getData().resetBacklinks();
		n.getData().resetChildrenBuffers();
		
		var db;
		var newDoc;
		var that = this;
		return DocumentAccess.getInstance().loadDocuments([doc])
		.then(function(/*resp*/) {
			return Database.getInstance().get();
		})
		.then(function(dbRef) {
			db = dbRef;

			if (doc.type == "attachment") {
				return Promise.reject({
					message: 'Attachments cannot be copied.',
					messageThreadId: 'CopyMessages'
				});
			}
			
			var name = prompt("New name:", doc.name);
			if (!name || name.length == 0) {
				return Promise.reject({
					abort: true,
					message: "Nothing changed.",
					messageThreadId: 'CopyMessages'
				});
			}
			
			// Create a new note with the content of the original.
			newDoc = {
				_id: n.getData().generateIdFrom(name),
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
			n.getData().add(newDoc);
			
			// Execute callbacks
    		Callbacks.getInstance().executeCallbacks('copy', newDoc);
    		
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
			var doc = Notes.getInstance().getData().getById(ids[i]);
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
		Notes.getInstance().getData().each(function(doc) {
			if (doc.type == 'reference') existingRefs.push(doc._id);
		});
		
		var selector = Notes.getInstance().getMoveTargetSelector(existingRefs);
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
	        		var tdoc = Notes.getInstance().getData().getById(target);
	        		
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
		var n = Notes.getInstance();
		var t = NoteTree.getInstance();
		
		var docTarget = n.getData().getById(targetId);
		var docsInvolved = [docTarget];

		var docsSrc = [];
    	for(var i in ids) {
    		var doc = n.getData().getById(ids[i]);
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
    		parentsChildren = n.getData().getChildren(targetId);
    	} else {
    		parentsChildren = n.getData().getChildren(docTarget.parent);
    	}
    	
    	for(var i in parentsChildren) {
    		docsInvolved.push(parentsChildren[i]);
    	}
    	
    	if (!moveToSubOfTarget) {
			for(var s in docsSrc) {
	    		var siblings = t.reorderVisibleSiblings(docsSrc[s], true);
	    		for(var i in siblings) {
					var sibling = n.getData().getById(siblings[i]);
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
    	
    	return DocumentAccess.getInstance().loadDocuments(docsInvolved)
    	.then(function(/*resp*/) {
	    	if (!targetId || moveToSubOfTarget) {
	    		for(var s in docsSrc) {
	    			if (docsSrc[s].parent != targetId) {
	    				Document.addChangeLogEntry(docsSrc[s], 'parentChanged', {
	    					from: docsSrc[s].parent,
	    					to: targetId
	    				});
	    				
	    				n.getData().setParent(docsSrc[s]._id, targetId);
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
		    			
		    			n.getData().setParent(docsSrc[s]._id, docTarget.parent);
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
		    		var ouIds = t.reorderVisibleSiblings(docsSrc[s]);
		    		for(var i in ouIds) {
		    			updateIds.push(ouIds[i]);
		    		}
		    	}
	    	}
			
			// Execute callbacks
			Callbacks.getInstance().executeCallbacks('moveDocumentBeforeSave', {
				docsSrc: docsSrc,
				docTarget: docTarget,
				moveToSubOfTarget: moveToSubOfTarget,
				updateIds: updateIds
			});
			
	    	// Save the new tree structure by updating the metadata of all touched objects.
	    	return DocumentAccess.getInstance().saveItems(updateIds);
    	})
    	.then(function(/*data*/) {
    		// Execute callbacks
    		Callbacks.getInstance().executeCallbacks('moveDocumentAfterSave', {
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
	 * Delete whole change log of a note
	 */
	deleteChangeLog(id) {
		var db;
		
		return Database.getInstance().get()
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
		
		var n = Notes.getInstance();
		
		n.getData().resetBacklinks();
		n.getData().resetChildrenBuffers();
		
		var doc = null;
		var that = this;
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			return db.query(Views.getInstance().getViewDocId() + '/deleted', {
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
			if (doc.parent && !n.getData().getById(doc.parent)) {
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
				
				console.log('Undeleting ' + n.getData().getReadablePath(undeleteDocs[i]._id));
			}

			return db.bulkDocs(undeleteDocs);
		})
		.then(function (/*data*/) {
			return TreeActions.getInstance().requestTree();
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
		var n = Notes.getInstance();
		
		var db;
		var doc;
		
		n.getData().resetBacklinks();
		n.getData().resetChildrenBuffers();
		
		return Database.getInstance().get()
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
				n.routing.call(id);
				
				return TreeActions.getInstance().requestTree();
			} else {
				n.resetPage();
				return TrashActions.getInstance().showTrash();
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
			var doc = Notes.getInstance().getData().getById(ids[i]);
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
		return ImageDialog.getInstance().askForImage(
			docs[0],
			displayName,
			docs[0].backImage,
			Config.ITEM_BACKGROUND_MAX_WIDTH, 
			Config.ITEM_BACKGROUND_MAX_HEIGHT, 
			Config.ITEM_BACKGROUND_MIME_TYPE,
			Config.ITEM_BACKGROUND_QUALITY,
			Config.ITEM_BACKGROUND_DONT_RESCALE_BELOW_BYTES
		)
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
		var n = Notes.getInstance();
		var t = NoteTree.getInstance();

		ids = Tools.removeDuplicates(ids);

		var docsSrc = [];
    	for(var i in ids) {
    		var doc = n.getData().getById(ids[i]);
    		if (!doc) {
    			return Promise.reject({
    				message: 'Document ' + ids[i] + ' not found',
					messageThreadId: 'SetItemBgImageMessages'
    			});
    		}
    		docsSrc.push(doc);
    	}
    	
    	return DocumentAccess.getInstance().loadDocuments(docsSrc)
    	.then(function(resp) {
	    	for(var s in docsSrc) {
	    		docsSrc[s].backImage = backImage;
	
				// Change log entry
				Document.addChangeLogEntry(docsSrc[s], 'backImageChanged', { 
					bytes: JSON.stringify(backImage).length
				});
	    	}
			
			// Execute callbacks
			Callbacks.getInstance().executeCallbacks('saveItemBackgroundImageeBeforeSave', {
				docsSrc: docsSrc,
				backImage: backImage
			});
		
	    	// Save the new tree structure by updating the metadata of all touched objects.
	    	return DocumentAccess.getInstance().saveItems(ids);
    	})
    	.then(function(/*data*/) {
			return TreeActions.getInstance().requestTree();
		})
    	.then(function(/*data*/) {
    		// Execute callbacks
    		Callbacks.getInstance().executeCallbacks('saveItemBackgroundImageAfterSave', {
    			docsSrc: docsSrc,
    			backImage: backImage
    		});
    		
    		return Promise.resolve({ ok: true });
    	})
    	.then(function(/*data*/) {
			return Notes.getInstance().reloadCurrentEditor();
		})
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
		var doc = Notes.getInstance().getData().getById(id);
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
		if (!doc.stub) {
			return Promise.resolve(doc.backImage);
		}

		var db;
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			return db.query(Views.getInstance().getViewDocId() + '/bgimage', {
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
			
			//console.log(' -> Late Loader: Background image data for ' + id + ' loaded (' + Tools.convertFilesize(JSON.stringify(backImage).length) + ')');
			
			// Update data model
			if (Notes.getInstance().getData()) {
				if (doc) {
					doc.backImage = backImage;
					
					Document.update(doc, doc);
				}
			}

			// Execute callbacks
			Callbacks.getInstance().executeCallbacks('loadItemBackgroundImage', {
				id: id,
				backImage: backImage
			});
			
			// Return new document
			return Promise.resolve(backImage);
		});
	}
}