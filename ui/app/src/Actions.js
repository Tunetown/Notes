/**
 * Actions for the notes application.
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
class Actions {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!Actions.instance) Actions.instance = new Actions();
		return Actions.instance;
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Returns the ID of the design document where all views are stored. 
	 */
	getViewDocId() {
		return 'views_' + Notes.getInstance().appVersion;
	}
	
	/**
	 * Called at initial loading the app, to check if all views are there and up to date, 
	 * and to create/update them if not.
	 */
	updateViews() {
		return Database.getInstance().createOrUpdateViews(
			this.getViewDocId(), 
			Document.getViewDefinitions()
		);
	}
	
	/**
	 * Request the note tree, and set the tree view accordingly.
	 */
	requestTree() {
		var db;
		var that = this; 
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			return db.query(that.getViewDocId() + '/toc');
		})
		.then(function (data) {
			// For debugging
			if (data.rows.length > 0) {
				console.log(' -> TOC Loader: ' + Tools.convertFilesize(JSON.stringify(data).length) + ' loaded in ' + data.rows.length + ' documents');
			}

			// Set new data in a new data container
			Notes.getInstance().setData(new Data(data.rows ? data.rows : [], 'value'));
			
			// Execute callbacks
			that.executeCallbacks('requestTree');
			
			return Promise.resolve({
				ok: true
			});
		})
		.catch(function(err) {
			if (err.status == 404) {
				// Use fallback method (slow)
				return that.requestTreeFallback();
			}
		});
	}
	
	/**
	 * Fallback for requestTree in case the views are missing.
	 */
	requestTreeFallback() {
		var that = this; 
		return Database.getInstance().get()
		.then(function(db) {
			return db.allDocs({
				conflicts: true,
				include_docs: true
			});
		})
		.then(function(data) {
			// For debugging
			console.log(' -> TOC Loader: Views not found, using fallback: ' + Tools.convertFilesize(JSON.stringify(data.rows).length) + ' loaded in ' + data.rows.length + ' documents');
			
			// Set new data in a new data container
			Notes.getInstance().setData(new Data(data.rows ? data.rows : [], 'doc'));
			
			// Execute callbacks
			that.executeCallbacks('requestTree');

			return Promise.resolve({
				fallback: true,
				ok: true
			});
		});
	}
	
	/**
	 * Load all documents
	 */
	loadAllDocuments() {
		var all = [];
		Notes.getInstance().getData().each(function(doc) {
			all.push(doc);
		});
		
		return this.loadDocuments(all);
	}
	
	/**
	 * After this, the documents are loaded fully int the data instance.
	 */
	loadDocuments(docs) {
		if (!docs) return Promise.reject({ message: 'No docs passed' });
			
		var ids = [];
		for(var i in docs) {
			if (!docs[i]) continue;
			if (Document.isLoaded(docs[i])) continue;
			ids.push(docs[i]._id);
		}
		ids = Tools.removeDuplicates(ids);
		
		if (ids.length == 0) {
			//console.log(" -> Late Loader: All " + docs.length + " required documents already loaded");
			
			return Promise.resolve({
				ok: true,
				updatedIds: ids
			});
		}
		
		var that = this;
		return Database.getInstance().get()
		.then(function(db) {
			return db.allDocs({
				conflicts: true,
				include_docs: true,
				keys: ids
			});
		})
		.then(function (data) {
			if (!data.rows) {
				return Promise.reject({
					message: 'No documents received'
				});
			}
				
			// Update data
			for(var i in ids) {
				var docInput = null;
				for(var l in docs) {
					if (docs[l]._id == ids[i]) {
						docInput = docs[l];
						break;
					}
				}
				if (!docInput) {
					return Promise.reject({
						message: 'Document ' + ids[i] + ' not found in source data'
					});
				}
				
				var docLoaded = null;
				for(var l in data.rows) {
					if (data.rows[l].doc._id == ids[i]) {
						docLoaded = data.rows[l].doc;
						break;
					}
				}
				if (!docLoaded) {
					return Promise.reject({
						message: 'Document ' + ids[i] + ' not found in loaded data'
					});
				}

				Document.update(docInput, docLoaded);
				Document.setLoaded(docInput);
			}
			
			// For debugging
			console.log(" -> Late Loader: Loaded " + Tools.convertFilesize(JSON.stringify(data).length) + " (" + ids.length + " documents)");
			
			return Promise.resolve({
				ok: true,
				updatedIds: ids
			});
		}); 
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Request the content of a new note and set the editor accordingly.
	 */
	request(id) {
		if (!id) return Promise.reject({
			message: 'No id passed'
		});
		
		var db;
		var doc;

		var that = this;
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
					message: 'Error in reference: no target ID exists.'
				});
				return db.get(data.ref, { 
					conflicts: true 
				});
			} else {
				var e = Document.getDocumentEditor(data);
				if (!e) {
					return Promise.reject({
						message: 'No editor found for document type ' + data.type
					});
				}
				
				if (e.needsTreeData()) {
					if (!Notes.getInstance().getData()) {
						return that.requestTree();
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
						message: data.message
					});
				}
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

			// Execute callbacks
			var docs = [doc];
			var targetDoc = doc;
			if (doc.type == 'reference') {
				docs.push(data);
				targetDoc = data;
			}
			
			that.executeCallbacks('loadDocument', docs);

			// Open document in editor
			return that.requestEditor(targetDoc); 
		});	
	}
	
	/**
	 * Opens an appropriate editor for the given document.
	 */
	requestEditor(doc) {
		var n = Notes.getInstance();
		n.triggerUnSyncedCheck();
		n.addFavorite(doc);
		
		var that = this;
			
		if (doc.type == "attachment") {
			var db;
			return this.loadDocuments([doc])
			.then(function(resp) {
				if (doc._conflicts && doc._conflicts.length) {
					n.showAlert('There are conflicts with this document, please check the conflicts list.', 'W', "ConflictWarnings");
				}
				
				if (doc.deleted) {
					n.showAlert('This document is deleted.', 'W');
				}
				
				return Database.getInstance().get();
			})
			.then(function(dbRef) {
				db = dbRef;
				return db.getAttachment(doc._id, doc.attachment_filename);
			})
			.then(function(data) {
				var url = URL.createObjectURL(data);
				AttachmentPreview.getInstance().load(doc, url);
				
				// Execute callbacks
				that.executeCallbacks('openDocument', doc);
				
				return Promise.resolve({
					ok: true
				});
			});

		} else {
			return this.loadDocuments([doc])
			.then(function(resp) {
				if (doc._conflicts && doc._conflicts.length) {
					n.showAlert('There are conflicts with this document, please check the conflicts list.', 'W', "ConflictWarnings");
				}
				
				if (doc.deleted) {
					n.showAlert('This document is deleted.', 'W');
				}
				
				var e = Document.getDocumentEditor(doc);
				e.load(doc);
				
				// Execute callbacks
				that.executeCallbacks('openDocument', doc);
				
				return Promise.resolve({
					ok: true
				});
			});
		}
	}
	
	/**
	 * Creates one or more documents (in case of attachments multiple selection) in the passed parent ID.
	 */
	create(id) {
		var n = Notes.getInstance();
		
		var doc = n.getData().getById(id);
		if (!doc && (id.length > 0)) return Promise.reject({
			message: 'Item ' + id + ' does not exist' 
		});  
		
		if ((id.length > 0) && (doc.type == 'reference')) return Promise.reject({
			message: 'Document ' + doc.name + ' is a reference and cannot have children.' 
		});

		var existingRefs = [];
		n.getData().each(function(doc) {
			if (doc.type == 'reference') existingRefs.push(doc._id);
		});
		
		var refSelector = n.getMoveTargetSelector(existingRefs, true);

		var e = n.getCurrentEditor();
		/*if (e && e.getCurrentId()) {
			refSelector.val(e.getCurrentId());
		}*/
		refSelector.val('');
		
		var typeSelector = Document.getAvailableTypeSelect('createTypeInput');
		
		var type;
		var name;
		var refTarget;
		var files;
		var newIds = [];
		var docs = [];
		var db;
		var that = this;
		return new Promise(function(resolve, reject) {
			$('#selectTypeContainer').empty();
			$('#selectTypeContainer').append(
				typeSelector
				.on('change', function(event) {
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
				refSelector
				.on('change', function(event) {
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
			$('#createWarnText').html('Name already exists');
			
			$('#createNameInput').off('input');
			$('#createNameInput').on('input', function(e) {
				var val = $(this).val();
				
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
				}, 300);
			});
			
			$('#newRootText').html(doc ? doc.name : Config.ROOT_NAME);
			
			function createKeyPressed(e) {
			    if(e.which == 13) {
			    	$('#createSubmitButton').click();
			    }
			}
			
			$('#createDialog').off('shown.bs.modal');
			$('#createDialog').on('shown.bs.modal', function (e) {
				$('#createNameInput').focus();
				$(document).keypress(createKeyPressed);
			});
			$('#createDialog').off('hidden.bs.modal');
			$('#createDialog').on('hidden.bs.modal', function (e) {
				$(document).unbind('keypress', createKeyPressed);
				reject({
					abort: true,
					message: 'Action canceled.'
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
		.then(function(data) {
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
				    
				    data._attachments[strippedName] = {
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
						message: 'Error: ' + data[d].message
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
				
				if (!Document.isPartOfBoard(doc)) {
					n.routing.call(doc._id);
				}
			}
			
			for(var d in data.rows) {
				var doc = data.rows[d].doc;
				
				// Update data model
				n.getData().add(doc);
			}
			
			// Execute callbacks
			that.executeCallbacks('create', newIds);
			
			return Promise.resolve({
				ok: true,
				message: 'Successfully created ' + newIds.length + ' document(s)',
				newIds: newIds
			});
		}); 
	}

	/**
	 * Saves the current note content to the server, creating a new version of it.
	 */
	save(id, content) { 
		if (!id) return Promise.reject({ message: 'No ID passed' });
			
		var n = Notes.getInstance();
		var e = n.getCurrentEditor();
		
		var data = n.getData().getById(id);
		if (!data) {
			return Promise.reject({
				message: 'Document ' + id + ' not found'
			});
		}
		
		var that = this;
		return this.loadDocuments([data])
		.then(function(resp) {
			if (Document.getContent(data) == content) {
				if (e) e.resetDirtyState();
				
				return Promise.reject({ 
					abort: true,
					message: "Nothing changed."
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
			
			return that.saveItem(id);
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
				that.executeCallbacks('save', data);
				
				console.log("Successfully saved " + data.name);
				
				return Promise.resolve({ 
					ok: true,
					message: "Successfully saved " + data.name + "."
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
	deleteItems(ids) {
		var n = Notes.getInstance();
		
		var containedRefs = [];
		var docs = [];
		var children = [];
		for(var i in ids) {
			var doc = n.getData().getById(ids[i]);
			if (!doc) return Promise.reject({ 
				message: 'Document ' + ids[i] + ' not found'
			});
			docs.push(doc);

			var crefs = n.getData().getReferencesTo(doc._id);
			for(var o in crefs || []) {
				containedRefs.push(crefs[o]);
			}
			
			// Unload editor if the item is opened somewhere
			var e = Document.getDocumentEditor(doc);
			if (e && (ids[i] == e.getCurrentId())) {
				e.unload();
			}
			
			var docChildren = n.getData().getChildren(ids[i], true);
			for(var c in docChildren) {
				children.push(docChildren[c]);
				
				var crefs = n.getData().getReferencesTo(docChildren[c]._id);
				for(var o in crefs || []) {
					containedRefs.push(crefs[o]);
				}
			}
		}
		
		if (containedRefs.length) { 
			var str = '';
			for(var o in containedRefs) {
				str += n.getData().getReadablePath(containedRefs[o]._id) + '\n';
			}
			alert('The following references still point to the item(s) to be deleted, please delete them first: \n\n' + str);
			return Promise.reject({
				message: 'References still exist.'
			});
		}
		
		var addstr = children.length ? (' including ' + children.length + ' contained items') : '';
		var displayName = (docs.length == 1) ? docs[0].name : (docs.length + ' documents');
		
		if (!confirm("Really delete " + displayName + addstr + "?")) {
			return Promise.reject({
				abort: true,
				message: "Action canceled."
			});
		}
		
		// Merge all documents into docs
		for (var l in children) {
			docs.push(children[l]);
		}
		
		var that = this;
		return this.loadDocuments(docs)
		.then(function(resp) {
			var ids = [];
			for(var d in docs) {
				var doc = docs[d];
				doc.deleted = true;
				Document.addChangeLogEntry(doc, 'deleted');
				console.log('Deleting ' + n.getData().getReadablePath(doc._id));
				ids.push(doc._id);
			}
			
			return that.saveItems(ids);
		})
		.then(function (data) {
			// Execute callbacks
			that.executeCallbacks('delete', docs);

			return Promise.resolve({
				ok: true,
				message: "Successfully trashed " + displayName + "."
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
			message: 'Item ' + id + ' not found'
		});
		
		var name = prompt("New name:", doc.name);
		if (!name || name.length == 0) {
			return Promise.reject({
				abort: true,
				message: "Nothing changed."
			});
		}

		var that = this;
		return this.loadDocuments([doc])
		.then(function(resp) {
			Document.addChangeLogEntry(doc, 'renamed', {
				from: doc.name,
				to: name
			});
			doc.name = name;
				
			return that.saveItem(id)
		})
		.then(function (data) {
			// Execute callbacks
			that.executeCallbacks('rename', doc);
			
			return Promise.resolve({
				ok: true,
				message: "Successfully renamed item."
			});
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
				message: 'Document ' + ids[i] + ' not found'
			});
			
			docs.push(doc);
		}

		if (ids.length == 0) return Promise.reject({
			message: 'Nothing to move'
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

		$('#moveSubmitButton').html('Move');
		
		var that = this;
		return new Promise(function(resolve, reject) {
			$('#moveSubmitButton').off('click');
			$('#moveSubmitButton').on('click', function(event) {
				$('#moveTargetSelector').off('hidden.bs.modal');
	        	$('#moveTargetSelector').modal('hide');
	        	var target = selector.val();
	        	if (target == "_cancel") {
	        		reject({
	        			abort: true,
						message: "Action cancelled."
					});
	        		return;
	        	}
	        	
	        	that.moveDocuments(ids, target, true)
	        	.then(function(data) {
	        		var tdoc = Notes.getInstance().getData().getById(target);
	        		
					resolve({
						ok: true,
						message: 'Moved ' + displayName + ' to ' + (tdoc ? tdoc.name : Config.ROOT_NAME)
					});
	        	})
	        	.catch(function(err) {
	        		reject({
						message: "Error moving document(s): " + err.message
					});
	        	});
			});
			
			$('#moveTargetSelector').off('hidden.bs.modal');
			$('#moveTargetSelector').on('hidden.bs.modal', function () {
				reject({
					abort: true,
					message: 'Action cancelled.'
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
    				message: 'Document ' + ids[i] + ' not found'
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
    	
    	var updateIds = [];
    	
    	var that = this;
    	return this.loadDocuments(docsInvolved)
    	.then(function(resp) {
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
	    	
		    	// Default the order of the moved item to the beginning, just like new documents.
	    		docsSrc[s].order = 0;
		    	
		    	// In case of staying in the same parent, re-oder the children of the new parent accordingly. 
		    	// We just take the order of items the grid gives us, and even when the items might not all be there, this makes sense as it
		    	// always resembles the order the user sees (if he sees any).
		    	if (!moveToSubOfTarget) {
		    		var ouIds = t.reorderVisibleChildItems(docsSrc[s].parent);
		    		for(var i in ouIds) {
		    			updateIds.push(ouIds[i]);
		    		}
		    	}
	    	}
			
			// Execute callbacks
			that.executeCallbacks('moveDocumentBeforeSave', {
				docsSrc: docsSrc,
				docTarget: docTarget,
				moveToSubOfTarget: moveToSubOfTarget,
				updateIds: updateIds
			});
		
	    	// Save the new tree structure by updating the metadata of all touched objects.
	    	return that.saveItems(updateIds);
    	})
    	.then(function(data) {
    		// Execute callbacks
    		that.executeCallbacks('moveDocumentAfterSave', {
    			docsSrc: docsSrc,
    			docTarget: docTarget,
    			moveToSubOfTarget: moveToSubOfTarget,
    			updateIds: updateIds
    		});
    		
    		return Promise.resolve({ ok: true });
    	})
    	.then(function(data) {
    		t.unblock();

    		return Promise.resolve({ ok: true });
    	});
	}
	
	/**
	 * Sets a new reference target. id must be a reference.
	 */
	setReference(id) {
		var doc = Notes.getInstance().getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found'
		});
		
		if (doc.type != 'reference') return Promise.reject({
			message: 'Document ' + id + ' is no reference'
		});
		
		var existingRefs = [id];
		Notes.getInstance().getData().each(function(doc) {
			if (doc.type == 'reference') existingRefs.push(doc._id);
		});
		
		var selector = Notes.getInstance().getMoveTargetSelector(existingRefs, true);
		selector.val(doc.ref);
		
		$('#moveTargetSelectorList').empty();
		$('#moveTargetSelectorList').append(selector);

		// Enable searching by text entry
		selector.selectize({
			sortField: 'text'
		});

		$('#moveSubmitButton').html('Save');
		
		var that = this;
		return new Promise(function(resolve, reject) {
			$('#moveSubmitButton').off('click');
			$('#moveSubmitButton').on('click', function(event) {
				$('#moveTargetSelector').off('hidden.bs.modal');
	        	$('#moveTargetSelector').modal('hide');
	        	var target = selector.val();
	        	if (target == "_cancel") {
	        		reject({
	        			abort: true,
						message: "Action cancelled."
					});
	        		return;
	        	}
	        	
				var tdoc = Notes.getInstance().getData().getById(target);
	        	if (!tdoc) {
					Notes.getInstance().showAlert('Target not found: ' + target, 'E', 'SetRefMessages');
					return;
				}
				
	        	that.loadDocuments([doc])
	        	.then(function(data) {
					Document.addChangeLogEntry(doc, 'referenceChanged', {
						oldRev: doc.ref,
						newRef: target
					});
					
					doc.ref = target;
					
					return that.saveItem(id)
				})
				.then(function(data) {
					resolve({
						ok: true,
						message: 'Saved new target for ' + doc.name + ' to ' + tdoc.name
					});
	        	})
	        	.catch(function(err) {
	        		reject({
						message: "Error saving target: " + err.message
					});
	        	});
			});
			
			$('#moveTargetSelector').off('hidden.bs.modal');
			$('#moveTargetSelector').on('hidden.bs.modal', function () {
				reject({
					abort: true,
					message: 'Action cancelled.'
				});
			});
			
			$('#moveTargetSelectorText').text('Point ' + doc.name + ' to:');
			$('#moveTargetSelector').modal();
		});
	}
	
	/**
	 * Creates a new reference for ID.
	 */
	createReference(id) {
		var n = Notes.getInstance();

		var doc = n.getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found'
		});
		
		var existingRefs = [id];
		n.getData().each(function(doc) {
			if (doc.type == 'reference') existingRefs.push(doc._id);
		});
		
		var selector = n.getMoveTargetSelector(existingRefs, false);
		//selector.val(doc.ref);
		
		$('#createReferenceDialogContent').empty();
		$('#createReferenceDialogContent').append(selector);

		// Enable searching by text entry
		selector.selectize({
			sortField: 'text'
		});

		var that = this;
		
		return new Promise(function(resolve, reject) {
			$('#createReferenceDialogSubmitButton').off('click');
			$('#createReferenceDialogSubmitButton').on('click', function(event) {
				$('#createReferenceDialog').off('hidden.bs.modal');
	        	$('#createReferenceDialog').modal('hide');
	        	var target = selector.val();
	        	if (target == "_cancel") {
	        		reject({
	        			abort: true,
						message: "Action cancelled."
					});
	        		return;
	        	}
	        	
				// Here, target can be empty for a ref at root level.
				if (target.length > 0) {
					// If there is a target, it has to really exist
					var tdoc = n.getData().getById(target);
		        	if (!tdoc) {
						reject({
							message: 'Target not found: ' + target
						});
						return;
					}
				}
				
				// Create new document
				var data = {
					_id: n.getData().generateIdFrom(doc.name),
					type: 'reference',
					name: doc.name,
					parent: target,
					order: 0,
					timestamp: Date.now(),
					ref: id
				};
				
				Document.addChangeLogEntry(data, 'created', {
					parent: id
				});
				
				Document.updateMeta(data);
				
				var db;
				var newIds = [];
				
				return Database.getInstance().get()
				.then(function(dbRef) {
					db = dbRef;
					return db.bulkDocs([data]);
				})
				.then(function(ret) {
					for(var d in ret) {
						if (!ret[d].ok) {
							return Promise.reject({
								message: 'Error: ' + ret[d].message
							});
						}
						
						newIds.push(ret[d].id);
					}
					
					return db.allDocs({
						conflicts: true,
						include_docs: true,
						keys: newIds
					});
				})
				.then(function(data) {
					// Execute callbacks and reload data
					that.executeCallbacks('createReference', newIds);
					
					return that.requestTree();
				})
				.then(function(data) {
					// Everything went fine
					resolve({
						ok: true,
						message: 'Successfully created ' + newIds.length + ' references.',
						newIds: newIds
					});
				})
	        	.catch(function(err) {
					// Error handling
	        		reject({
						message: "Error saving target: " + err.message
					});
	        	});
			});
			
			$('#createReferenceDialog').off('hidden.bs.modal');
			$('#createReferenceDialog').on('hidden.bs.modal', function () {
				reject({
					abort: true,
					message: 'Action cancelled.'
				});
			});
			
			$('#createReferenceDialogText').text('Create reference to ' + doc.name + ' in:');
			$('#createReferenceDialog').modal();
		});
	}
	
	/**
	 * Copy the given document.
	 */
	copyItem(id) {
		if (!id) return Promise.reject({
			message: 'No id passed'
		});
		
		var n = Notes.getInstance();
		
		var doc = Notes.getInstance().getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found'
		});
		
		var db;
		var newId;
		var newDoc;
		var that = this;
		return this.loadDocuments([doc])
		.then(function(resp) {
			return Database.getInstance().get();
		})
		.then(function(dbRef) {
			db = dbRef;

			if (doc.type == "attachment") {
				return Promise.reject({
					message: 'Attachments cannot be copied.'
				});
			}
			
			var name = prompt("New name:", doc.name);
			if (!name || name.length == 0) {
				return Promise.reject({
					abort: true,
					message: "Nothing changed."
				});
			}
			
			// Create a new note with the content of the original.
			newDoc = {
				_id: n.getData().generateIdFrom(name),
				type: doc.type,
				name: name,
				parent: doc.parent,
				order: doc.order,
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
    		that.executeCallbacks('copy', newDoc);
    		
			return that.request(newDoc._id);
		})
		.catch(function(err) {
			that.unlock(id);
			return Promise.reject(err);
		});
	}
	
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Shows the labels of a note
	 */
	requestLabelDefinitions(id) {
		var db;
		var that = this;
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			return db.get(id);
		})
		.then(function (data) {
			var l = LabelDefinitions.getInstance();
			l.load(data);
			
			return Promise.resolve({ ok: true });
		});
	}
	
	/**
	 * Saves the label definitions for the given document.
	 */
	saveLabelDefinitions(id) {
		if (!id) return Promise.reject({ message: 'No ID passed' });
		
		var n = Notes.getInstance();
		
		var doc = n.getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found'
		});
		
		Document.addChangeLogEntry(doc, 'labelDefinitionsChanged');	
			
		var that = this;
		return this.saveItem(id)
		.then(function(dataResp) {
			if (!dataResp.abort) {
				// Execute callbacks
				that.executeCallbacks('saveLabelDefinitions', [doc]);
				
				console.log("Successfully saved label definitions of " + doc.name);
				
				return Promise.resolve({ 
					ok: true,
					message: "Successfully saved label definitions of " + doc.name + "."
				});
			} else {
				return Promise.resolve(dataResp);
			}
		});
	}
	
	/**
	 * Saves the labels for the given document.
	 */
	saveLabels(id) {
		if (!id) return Promise.reject({ message: 'No ID passed' });
		
		var n = Notes.getInstance();
		
		var doc = n.getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found'
		});
		
		Document.addChangeLogEntry(doc, 'labelsChanged');	
			
		var that = this;
		return this.saveItem(id)
		.then(function(dataResp) {
			if (!dataResp.abort) {
				// Execute callbacks
				that.executeCallbacks('saveLabels', doc);
				
				console.log("Successfully saved labels of " + doc.name);
				
				return Promise.resolve({ 
					ok: true,
					message: "Successfully saved labels of " + doc.name + "."
				});
			} else {
				return Promise.resolve(dataResp);
			}
		});
	}
	
	/**
	 * Move an item's label definition to another document.
	 * This is reusing the move target input modal dialog.
	 */
	moveLabelDefinition(id, labelId) {
		var doc = Notes.getInstance().getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found'
		});

		var def = Document.getLabelDefinition(doc, labelId);
		if (!def) return Promise.reject({
			message: 'Definition for label ' + labelId + ' not found'
		});
		
		var selector = this.getMoveLabelDefinitionTargetSelector();
		selector.css('max-width', '100%');
		selector.val(id);
		
		$('#moveTargetSelectorList').empty();
		$('#moveTargetSelectorList').append(selector);

		var tdoc;
		var that = this;
		return new Promise(function(resolve, reject) {
			$('#moveSubmitButton').off('click');
			$('#moveSubmitButton').on('click', function(event) {
				$('#moveTargetSelector').off('hidden.bs.modal');
	        	$('#moveTargetSelector').modal('hide');
	        	var target = selector.val();
	        	if (target == "_cancel") {
	        		reject({
	        			abort: true,
						message: "Action cancelled."
					});
	        		return;
	        	}

	        	tdoc = Notes.getInstance().getData().getById(target);
	        	if (!tdoc) {
	        		Notes.getInstance().showAlert('Please select a target document.', 'E', 'MoveMessages');
	        		return;
	        	}
	       
	        	that.loadDocuments([doc, tdoc])
	        	.then(function(resp) {
	        		Document.removeLabelDefinition(doc, labelId);
	        		Document.addChangeLogEntry(doc, 'labelDefinitionsChanged');	
	        		
	        		Document.addLabelDefinition(tdoc, def);
	        		Document.addChangeLogEntry(tdoc, 'labelDefinitionsChanged');	
	        		
	        		return that.saveItems([doc._id, tdoc._id]);
	        	})
	        	.then(function(data) {
	        		// Execute callbacks
					that.executeCallbacks('saveLabelDefinitions', [doc, tdoc]);
					
					resolve({
						ok: true,
						newOwner: tdoc._id,
						message: 'Moved label definition ' + labelId + ' from ' + doc.name + ' to ' + tdoc.name
					});
	        	})
	        	.catch(function(err) {
	        		reject({
						message: "Error moving label definition: " + err.message
					});
	        	});
			});
			
			$('#moveTargetSelector').off('hidden.bs.modal');
			$('#moveTargetSelector').on('hidden.bs.modal', function () {
				reject({
					abort: true,
					message: 'Action cancelled.'
				});
			});
			
			$('#moveTargetSelectorSourceName').text('label definition ' + def.name);
			$('#moveTargetSelector').modal();
		});
	}
	
	/**
	 * Returns the selector for moving label definitions.
	 */
	getMoveLabelDefinitionTargetSelector() {
		var selector = $('<select></select>');
		var ids = [];

		var d = Notes.getInstance().getData();
		
		d.each(function(doc) {
			ids.push({
				text: d.getReadablePath(doc._id),
				id: doc._id,
			});
		});
		
		ids.sort(function(a, b) { 
			if (a.text < b.text) return -1;
			if (a.text > b.text) return 1;
			return 0;
		});
		
		for(var i in ids) {
			selector.append(
				$('<option value="' + ids[i].id + '">' + Notes.getInstance().formatSelectOptionText(ids[i].text) + '</option>')
			);
		}
		return selector;
	}
	
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	/**
	 * Saves the note's editor mode to the server.
	 */
	saveEditorMode(id, editorMode, editorParams) {
		if (!id) return Promise.reject({ message: 'No ID passed' });
			
		var n = Notes.getInstance();
		
		var doc = n.getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found'
		});
		
		var that = this;
		return this.loadDocuments([doc])
		.then(function(resp) {
			Document.addChangeLogEntry(doc, 'editorModeChanged', {
				from: doc.editor,
				to: editorMode
			});	
			
			doc.editor = editorMode;
			if (editorParams) doc.editorParams = editorParams;
			
			return that.saveItem(id);
		})
		.then(function(dataResp) {
			if (!dataResp.abort) {
				// Execute callbacks
				that.executeCallbacks('saveEditorMode', doc);
				
				console.log("Successfully saved " + doc.name);
				
				return Promise.resolve({ 
					ok: true,
					message: "Successfully saved " + doc.name + "."
				});
			} else {
				return Promise.resolve(dataResp);
			}
		});
	}
	
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Saves the note's board state to the server.
	 */
	saveBoardState(id, state) {
		if (!id) return Promise.reject({ message: 'No ID passed' });
			
		var n = Notes.getInstance();
		
		var doc = n.getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found'
		});

		var that = this;
		return this.loadDocuments([doc])
		.then(function(resp) {
			doc.boardState = state;
			
			return that.saveItem(id);
		})
		.then(function(dataResp) {
			if (!dataResp.abort) {
				// Execute callbacks
				that.executeCallbacks('saveBoardState', doc);
				
				console.log("Successfully saved state of " + doc.name);
				
				return Promise.resolve({ 
					ok: true,
					message: "Successfully saved state of " + doc.name + "."
				});
			} else {
				return Promise.resolve(dataResp);
			}
		});
	}
	
	/**
	 * Sets a new board background image for the given document
	 */
	setBoardBackgroundImage(id) {
		if (!id) return Promise.reject({ message: 'No ID passed' });
		
		var n = Notes.getInstance();
		
		var doc = n.getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found'
		});
		
		var that = this;
		return this.loadDocuments([doc])
		.then(function(resp) {
			return that.selectBoardBackgroundImage(doc);
		})
		.then(function(data) {
			var newImageId = data.id ? data.id : false;
			Document.addChangeLogEntry(doc, 'boardBackgroundChanged', {
				from: doc.boardBackground,
				to: newImageId
			});	
			
			doc.boardBackground = newImageId;
			
			return that.saveItem(id);
		})
		.then(function(dataResp) {
			if (!dataResp.abort) {
				// Execute callbacks
				that.executeCallbacks('setBoardBackgroundImage', doc);
				
				console.log("Successfully saved background image of " + doc.name);
				
				return Promise.resolve({ 
					ok: true,
					message: "Successfully saved background image of " + doc.name + "."
				});
			} else {
				return Promise.resolve(dataResp);
			}
		});
	}
	
	/**
	 * Shows the dialog to select the background image for the given document.
	 */
	selectBoardBackgroundImage(doc) {
		var selector = Notes.getInstance().getBackgroundImageSelector();
		selector.css('max-width', '100%');
		selector.val(doc.boardBackground ? doc.boardBackground : '_cancel');
		
		$('#backgroundImageSelectorList').empty();
		$('#backgroundImageSelectorList').append(selector);

		var that = this;
		return new Promise(function(resolve, reject) {
			$('#backgroundImageSubmitButton').off('click');
			$('#backgroundImageSubmitButton').on('click', function(event) {
				$('#backgroundImageDialog').off('hidden.bs.modal');
	        	$('#backgroundImageDialog').modal('hide');
	        	var target = selector.val();
	        	if (target == "_cancel") {
	        		resolve({
						ok: true,
						id: false
					});
	        		return;
	        	}
	        	
	        	resolve({
					ok: true,
					id: target
				});
			});
			
			$('#backgroundImageDialog').off('hidden.bs.modal');
			$('#backgroundImageDialog').on('hidden.bs.modal', function () {
				reject({
					message: 'Action cancelled.',
					abort: true
				});
			});
			
			$('#backgroundImageText').text(doc.name);
			$('#backgroundImageDialog').modal();
		});
	}
	
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Request to view a note conflict revision.
	 */
	requestConflict(id, rev) {
		var db;
		var docCurrent;
		var that = this;
		
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
    		that.executeCallbacks('requestConflict', {
    			docConflict: docConflict,
    			docCurrent: docCurrent
    		});
		});
	}
	
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Request the settings for the user
	 */
	requestSettings() {
		var that = this;
		
		return Database.getInstance().get()
		.then(function(db) {
			return db.get('settings');
		})
		.then(function (data) {
			Settings.getInstance().set(data);
			
			// Execute callbacks
    		that.executeCallbacks('requestSettings', data);
    		
			return Promise.resolve({ ok: true });
		})
		.catch(function(err) {
			// Not found: This is no severe error in this case, so we resolve the promise instead of rejecting.
			if (err.status == 404) return Promise.resolve({ 
				ok: false,
				message: err.message
			});
			
			return Promise.reject({
				message: err.message
			});
		});
	}
	
	/**
	 * Request the settings for the user
	 */
	saveSettings() {
		var that = this;
		
		var doc;
		return Database.getInstance().get()
		.then(function(db) {
			//that.lock('settings');
			
			doc = Settings.getInstance().get();
			doc._id = 'settings';
			
			return db.put(doc);
		})
		.then(function (data) {
			if (!data.ok) {
				//that.unlock('settings');
				
				return Promise.reject({
					message: data.message
				});
			}
			
			return that.requestSettings();
		})
		.then(function (data) {
			// Execute callbacks
    		that.executeCallbacks('saveSettings', doc);
    		
    		//that.unlock('settings');
    		
			return Promise.resolve({
				message: "Saved settings."
			});
		})
		.catch(function(err) {
			//that.unlock('settings');
			return Promise.reject(err);
		});
	}

	/**
	 * Check settings consistency
	 */
	checkSettings() {
		return Database.getInstance().get()
		.then(function(db) {
			return db.get('settings');
		})
		.then(function (data) {
			var errors = [];
			var ret = Settings.getInstance().checkSettings(data, errors);
			return Promise.resolve({
				propertiesChecked: ret.numPropsChecked,
				errors: errors,
				ok: ret.ok
			});
		})
		.then(function(data) {
			return Database.getInstance().checkConflicts('settings')
			.then(function(data2) {
				var resp = Tools.mergeCheckResponses([data, data2]);
				resp.numChecked = 1;
				return Promise.resolve(resp);
			})
			.catch(function(data2) {
				var resp = Tools.mergeCheckResponses([data, data2]);
				resp.numChecked = 1;
				return Promise.reject(resp);
			});
		});
	}

	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	/**
	 * Returns the attachment item as URL
	 */
	getAttachmentUrl(id) {
		if (!id) return Promise.reject({ 
			message: 'No ID passed'
		});
		
		if (this.attachmentUrlBuffer) {
			var buf = this.attachmentUrlBuffer.get(id);
			
			if (buf) return Promise.resolve({
				ok: true,
				buffered: true,
				url: buf
			});
		}
		
		var doc = Notes.getInstance().getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Item ' + id + ' does not exist'
		});
		if (doc.type != 'attachment') return Promise.reject({
			message: 'Item ' + doc.name + ' is no attachment'
		});
		
		var that = this;
		return Database.getInstance().get()
		.then(function(db) {
			return db.getAttachment(id, doc.attachment_filename);
		})
		.then(function(data) {
			var url = URL.createObjectURL(data);
	
			if (!that.attachmentUrlBuffer) that.attachmentUrlBuffer = new Map();
			that.attachmentUrlBuffer.set(id, url);
			
			return Promise.resolve({
				ok: true,
				url: url
			});
		});
	}
	
	/**
	 * Replaces the passed doc (must be an attachment) from a file
	 */
	updateAttachmentFromFile(id) {
		var n = Notes.getInstance();
		
		var doc = n.getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' does not exist' 
		});  
		
		if (doc.type != 'attachment') return Promise.reject({
			message: 'Document ' + doc.name + ' is not an attachment' 
		});

		var file;
		var db;
		var that = this;
		return new Promise(function(resolve, reject) {
			$('#uploadFile').val('');

			$('#uploadText').html('Upload content for ' + doc.name);
			
			function keyPressed(e) {
			    if(e.which == 13) {
			    	$('#uploadSubmitButton').click();
			    }
			}
			
			$('#uploadDialog').off('shown.bs.modal');
			$('#uploadDialog').on('shown.bs.modal', function (e) {
				$(document).keypress(keyPressed);
			});
			$('#uploadDialog').off('hidden.bs.modal');
			$('#uploadDialog').on('hidden.bs.modal', function (e) {
				$(document).unbind('keypress', keyPressed);
				reject({
					abort: true,
					message: 'Action canceled.'
				 });
			});
			$('#uploadDialog').modal();
			
			// Set up submit button
			$('#uploadSubmitButton').off('click');
			$('#uploadSubmitButton').on('click', function(e) {
				e.stopPropagation();

	    		file = $('#uploadFile')[0].files[0];
	    		
	    		if (!file) {
	    			n.showAlert('Please select a file to upload.', 'E', 'UplAttMessages');
					return;
			    }

	    		var maxMB = parseFloat(Settings.getInstance().settings.maxUploadSizeMB);
	    		if (maxMB && (file.size > (maxMB * 1024 * 1024))) {
	    			n.showAlert('The file is too large: ' + Tools.convertFilesize(file.size) + '. You can change this in the settings.', 'E', 'UplAttMessages');
					return;
	    		}
		    		
		    	$(document).unbind('keypress', keyPressed);
		    	$('#uploadDialog').off('hidden.bs.modal');
		    	$('#uploadDialog').modal('hide');
			    
		    	resolve({
		    		ok: true
		    	});
			});
		})
		.then(function(data) {
			if (!data.ok) {
				return Promise.reject(data);
			}
			return that.loadDocuments([doc]);
		})
		.then(function(data) {
			var strippedName = Document.stripAttachmentName(file.name);
			
			doc.attachment_filename = strippedName;
			doc.timestamp = file.lastModified;
			doc.content_type = file.type;
			    
			doc._attachments[strippedName] = {
				content_type: file.type,
    			data: file,
				length: file.size
			};
		    
			Document.updateMeta(doc);
			
		    return that.saveItem(doc._id);
		})
		.then(function (data) {
			if (!data.ok) {
				return Promise.reject({
					message: 'Error: ' + data.message
				});
			}
			
			console.log("Successfully updated " + doc.name);
			
			// Execute callbacks
			that.executeCallbacks('updateAttachment', doc);
			
			return Promise.resolve({
				ok: true,
				message: 'Successfully updated ' + doc.name
			});
		});
	}
	
	/**
	 * Adds the passed files array as attachment children to the passed document.
	 */
	uploadAttachments(id, files) {
		var n = Notes.getInstance();
		
		var maxMB = parseFloat(Settings.getInstance().settings.maxUploadSizeMB);
		for(var f in files) {
			var file = files[f];
			if (maxMB && (file.size > (maxMB * 1024 * 1024))) {
				return Promise.reject({
					message: file.name + ' is too large: ' + Tools.convertFilesize(file.size) + '. You can change this in the settings.'
				});
			}
		}
		
		var doc = n.getData().getById(id);
		if (!doc && id.length) return Promise.reject({
			message: 'Document ' + id + ' does not exist' 
		});  
		
		if (id.length && (doc.type == 'reference')) return Promise.reject({
			message: 'Document ' + doc.name + ' is a reference and cannot have children' 
		});

		var docs = [];
		var newIds = [];
		var targetId = id;
		
		var db;
		var that = this;
		return new Promise(function(resolve, reject) {
			//$('#uploadFile').val('');

			$('#dropFilesText').html('Add ' + files.length + ' files?');
			
			var existingRefs = [];
			n.getData().each(function(doc) {
				if (doc.type == 'reference') existingRefs.push(doc._id);
			});
			
			var targetSelector = n.getMoveTargetSelector(existingRefs);
			targetSelector.css('width', '100%');
			targetSelector.val(id);
			
			$('#dropFilesSelectorContainer').empty();
			$('#dropFilesSelectorContainer').append(targetSelector);
			
			function keyPressed(e) {
			    if(e.which == 13) {
			    	$('#dropFilesSubmitButton').click();
			    }
			}
			
			$('#dropFilesDialog').off('shown.bs.modal');
			$('#dropFilesDialog').on('shown.bs.modal', function (e) {
				$(document).keypress(keyPressed);
			});
			$('#dropFilesDialog').off('hidden.bs.modal');
			$('#dropFilesDialog').on('hidden.bs.modal', function (e) {
				$(document).unbind('keypress', keyPressed);
				reject({
					abort: true,
					message: 'Action canceled.'
				 });
			});
			$('#dropFilesDialog').modal();
			
			// Set up submit button
			$('#dropFilesSubmitButton').off('click');
			$('#dropFilesSubmitButton').on('click', function(e) {
				e.stopPropagation();

				targetId = targetSelector.val();
				if (targetId != id) {
					doc = n.getData().getById(targetId);
					if (!doc && targetId.length) {
						n.showAlert('Document ' + targetId + ' not found', 'E', 'UplAttMessages');
						return;
					}
				}
	    		
				for(var f=0; f<files.length; ++f) {   // NOTE: No shorter form possible because of the type files has. Must be that way ;)
					var file = files[f];
					var strippedName = Document.stripAttachmentName(file.name);
					
				    var data = {
						_id: n.getData().generateIdFrom(file.name),
						type: "attachment",
						name: file.name,
						parent: targetId,
						order: 0,
						timestamp: file.lastModified,
						content_type: file.type,
						attachment_filename: strippedName,
						attachmentSize: file.size,          // Set here because the attachment has no length attribute yet.
						_attachments: {}
					};
				    
				    data._attachments[strippedName] = {
						content_type: file.type,
		    			data: file,
						length: file.size
					};
				    
					Document.updateMeta(data);
					
					docs.push(data);
				}
				
		    	$(document).unbind('keypress', keyPressed);
		    	$('#dropFilesDialog').off('hidden.bs.modal');
		    	$('#dropFilesDialog').modal('hide');

		    	resolve({
		    		ok: true
		    	});
			});
		})
		.then(function(data) {
			if (!data.ok) {
				return Promise.reject(data);
			}
			return Database.getInstance().get();
		})
		.then(function(dbRef) {
			db = dbRef;
			
			return db.bulkDocs(docs);
		})
		.then(function (data) {
			for(var d in data) {
				if (!data[d].ok) {
					return Promise.reject({
						message: 'Error: ' + data[d].message
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
			/*if (data.rows.length == 1) {
				var docc = data.rows[0].doc;
				if (!(docc && ((docc.editor == 'board') || (docc.parentDoc && (docc.parentDoc.editor == 'board'))))) {
					n.routing.call(docc._id);
				}
			}*/
			
			for(var d in data.rows) {
				var docc = data.rows[d].doc;
				
				// Update data model
				n.getData().add(docc);
			}
			
			n.routing.call(targetId);
			
			// Execute callbacks
			that.executeCallbacks('create', newIds);
			
			return Promise.resolve({
				ok: true,
				message: 'Successfully created ' + newIds.length + ' document(s)',
				newIds: newIds
			});
		}); 
	}
	
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	/**
	 * Show history for the note.
	 */
	showHistory(id) {
		return Database.getInstance().get()
		.then(function(db) {
			return db.get(id);
		})
		.then(function (data) {
			var v = Versions.getInstance();
			v.load(data);
			
			return Promise.resolve({ ok: true });
		});
	}

	/**
	 * Request to view a note history version
	 */
	requestVersion(id, name) { 
		var db;
		var doc;
		
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			return db.get(id);
		})
		.then(function (data) {
			doc = data;
			return db.getAttachment(id, name);
		})
		.then(function (attData) {
			return new Promise(function(resolve, reject) {
				var reader = new FileReader();
				reader.onload = function() {
					// Load data into the version viewer
					VersionView.getInstance().load(id, name, reader.result, doc);
					
					resolve({
						ok: true
					});
				}
				
				reader.readAsText(attData);
			});
		});
	}
	
	/**
	 * Delete note version callback
	 */
	deleteVersion(id, name) {
		var db;
		var that = this;
		
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			that.lock(id);
			
			return db.get(id);
		})
		.then(function (data) {
			return db.removeAttachment(id, name, data._rev)
		})
		.then(function (data) {
			if (!data.ok) {
				that.unlock(id);
				
				return Promise.reject({
					message: data.message
				});
			}
			
			that.unlock(id);
			return that.showHistory(id);
		})
		.then(function (data) {
			return Promise.resolve({
				ok: true,
				message: 'Successfully deleted version.'
			});
		})
		.catch(function(err) {
			that.unlock(id);
			return Promise.reject(err);
		});
	}

	/**
	 * Delete whole history of a note
	 */
	deleteHistory(id) {
		var db;
		
		var that = this;
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			that.lock(id);
			
			return db.get(id);
		})
		.then(function (data) {
			Document.addChangeLogEntry(data, 'deletedAllVersions', {
				numDeleted: (data._attachments || []).length
			});

			data._attachments = {};
			
			Document.updateMeta(data);
			
			return db.put(data);
		})
		.then(function (data) {
			if (!data.ok) {
				that.unlock(id);
				
				return Promise.reject({
					message: data.message
				});
			}
			
			that.unlock(id);
			
			return Promise.resolve({
				ok: true
			});
		})
		.catch(function(err) {
			that.unlock(id);
			return Promise.reject(err);
		});
	}
	
	/**
	 * Delete whole change log of a note
	 */
	deleteChangeLog(id) {
		var db;
		
		var that = this;
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			that.lock(id);
			
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
				that.unlock(id);
				
				return Promise.reject({
					message: data.message
				});
			}

			that.unlock(id);
			
			return Promise.resolve({
				ok: true
			});
		})
		.catch(function(err) {
			that.unlock(id);
			return Promise.reject(err);
		});
	}

	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	/**
	 * Shows the trash bin window.
	 */
	showTrash() {
		var db;
		var that = this;
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			return db.query(that.getViewDocId() + '/deleted', {
				include_docs: true
			});
		})
		.then(function (data) {
			var t = Trash.getInstance();
			
			if (!data.rows) {
				return Promise.resolve({
					ok: true,
					message: "Trash is empty."
				});
			}
			
			t.load(data.rows);
			
			return Promise.resolve({
				ok: true
			});
		});	
	}
	
	/**
	 * Restore the ghost version (id) with the new ID newId.
	 */
	undeleteItem(id) {
		var db;
		
		var n = Notes.getInstance();
		
		var doc = null;
		var that = this;
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			return db.query(that.getViewDocId() + '/deleted', {
				include_docs: true
			});
		})
		.then(function (data) {
			if (!data.rows) return Promise.reject({
				message: 'No documents to undelete'
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
				message: 'Document ' + id + ' seems not to be deleted.'
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
		.then(function (data) {
			return that.requestTree();
		})
		.then(function (data) {
			return Promise.resolve({
				ok: true,
				message: "Restored " + doc.name
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
		
		var that = this;
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
					message: "Nothing changed."
				});
			}
			doc = data;
			
			return db.remove(data);
		})
		.then(function (dataResp) {
			if (!dataResp.ok) {
				that.unlock(id);
				return Promise.reject({
					message: dataResp.message
				});
			}
			
			if (rev) {
				n.routing.call(id);
				
				return that.requestTree();
			} else {
				n.resetPage();
				return that.showTrash();
			}
		})
		.then(function (dataResp) {
			if (rev) {
				return Promise.resolve({
					ok: true,
					message: "Deleted revision " + rev + "."
				});
			} else {
				return Promise.resolve({
					ok: true,
					message: "Permanently deleted " + doc.name + "."
				});
			}
		});
	}

	/**
	 * Requests to empty the trash.
	 */
	emptyTrash() {
		var n = Notes.getInstance();
		var db;

		var that = this;
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			return db.query(that.getViewDocId() + '/deleted', {
				include_docs: true
			});
		})
		.then(function (data) {
			if (!confirm("Permanently delete " + data.rows.length + " trashed items?")) {
				return Promise.reject({
					abort: true,
					message: "Nothing changed."
				});
			}
			
			var docs = [];
			for(var i in data.rows) {
				data.rows[i].doc._deleted = true;
				docs.push(data.rows[i].doc);
			}
			
			return db.bulkDocs(docs);
		})
		.then(function (data) {
			n.resetPage();
			return that.showTrash();
		})
		.then(function (data) {
			return Promise.resolve({
				ok: true,
				message: "Trash is now empty."
			});
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
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
	
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Import an array of documents
	 */
	importDocuments(docs) {
		var n = Notes.getInstance();

		for(var i in docs) {
			var doc = docs[i];
			Document.updateMeta(doc);
		}
		
		var db;
		var that = this;
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			
			return db.bulkDocs(docs);
		})
		.then(function(data) {
			// Execute callbacks
			that.executeCallbacks('importFinished', docs);
			
			return Promise.resolve({
				ok: true,
				message: 'Successfully imported ' + docs.length + ' documents',
			});
		}); 
	}
	
	/**
	 * Export (download) documents. Expects an array of IDs.
	 */
	exportDocuments(ids) {
		var n = Notes.getInstance();
		
		var db;
		var that = this;
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			
			return db.allDocs({
				conflicts: true,
				include_docs: true,
				attachments: true,
				keys: ids
			});
		})
		.then(function(data) {
			if (!data.rows) {
				return Promise.reject({
					message: "Error: No data received."
				})
			}
			
			var docs = [];
			for(var i in data.rows) {
				docs.push(data.rows[i].doc);
			}
			
			var dataString = JSON.stringify(docs);
			var dataBlob = new Blob([dataString], {type: 'text/plain'});
			var url = URL.createObjectURL(dataBlob);
			
			// For debugging
			console.log(' -> ' + Tools.convertFilesize(dataString.length) + ' of data loaded in export request');

			window.saveAs(url, 'Notes Export ' + new Date().toLocaleString() + '.txt');
			
			return Promise.resolve({
				ok: true
			});
		}); 
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Generic function to save an existing document on DB.
	 */
	saveItem(id) {
		if (!id) return Promise.reject({ message: 'No ID passed' });
			
		var n = Notes.getInstance();
		
		var doc = n.getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found'
		});
		
		var that = this;
		return Database.getInstance().get()
		.then(function(db) {
			that.lock(id);

			Document.updateMeta(doc);
			
			// Save note
			return db.put(Document.clone(doc));
		})
		.then(function (dataResp) {
			that.unlock(id);
			if (!dataResp.ok) {
				return Promise.reject(dataResp);
			}
			
			doc._rev = dataResp.rev;
			Document.update(doc, doc);
			
			return Promise.resolve({
				ok: true
			});
		})
		.catch(function(err) {
			that.unlock(id);
			return Promise.reject(err);
		}); 
	}

	/**
	 * Generic function to save multiple existing documents to DB. Expects an array of IDs.
	 */
	saveItems(ids) {
		if (!ids) return Promise.reject({ message: 'No docs passed' });
		var n = Notes.getInstance();
			
		// Remove duplicates
		ids = Tools.removeDuplicates(ids);

		// Collect and lock documents
		var docs = [];
		for (var l in ids) {
			this.lock(ids[l]);
			
			var doc = n.getData().getById(ids[l]);
			if (!doc) {
				return Promise.reject({
					message: 'Document ' + ids[l] + ' not found'
				});
			}
			
			Document.updateMeta(doc);
			docs.push(Document.clone(doc));
		}
		
		// Save them
		var that = this;
		return Database.getInstance().get()
		.then(function(db) {
			return db.bulkDocs(docs);
		})
		.then(function (data) {
			// Update revisions
			var d = n.getData();
			for(var i in data || []) {
				var dd = d.getById(data[i].id);
				if (!dd) {
					return Promise.reject({
						message: 'Document ' + data[i].id + ' not found in loaded data'
					});
				}
				
				dd._rev = data[i].rev;
				Document.update(dd, dd);
			}
			
			// Unlock
			for(var i in ids) {
				that.unlock(ids[i]);
			}

			return Promise.resolve({
				ok: true
			});
		})
		.catch(function(err) {
			// Unlock
			for(var i in ids) {
				that.unlock(ids[i]);
			}
			return Promise.reject(err);
		}); 
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Returns a promise holding allDocs data including documents and conflicts (not attachments!), used for checks.
	 */
	getAllDocs() {
		var that = this;
		
		return Database.getInstance().get()
		.then(function(db) {
			return db.allDocs({
				conflicts: true,
				include_docs: true,
			});
		})
	}
	
	/**
	 * Check views.
	 */
	checkViews() {
		var that = this;
		return Database.getInstance().checkViews(
			this.getViewDocId(), 
			Document.getViewDefinitions()
		)
		.then(function(data) {
			return Database.getInstance().checkConflicts('_design/' + that.getViewDocId())
			.then(function(data2) {
				var resp = Tools.mergeCheckResponses([data, data2]);
				resp.numChecked = 1;
				return Promise.resolve(resp);
			})
			.catch(function(data2) {
				var resp = Tools.mergeCheckResponses([data, data2]);
				resp.numChecked = 1;
				return Promise.reject(resp);
			});
		});
	}
	
	/**
	 * Check unused views.
	 */
	checkUnusedViews() {
		var that = this;
		
		return Database.getInstance().get()
		.then(function(db) {
			return db.allDocs({
				startkey: '_',
				endkey: '_\ufff0'
			});
		})
		.then(function(data) {
			var errors = [];
			for(var i in data.rows) {
				var doc = data.rows[i];
				if (doc.id == '_design/' + that.getViewDocId()) continue;
				
				errors.push({
					message: 'Unused view',
					id: doc.id,
					type: 'W'
				});
			}
			
			var ok = errors.length == 0;
			if (ok) {
				errors.push({
					message: 'No unused design documents found',
					type: 'S'
				});
			}
			return Promise.resolve({
				docsChecked: data.rows,
				numChecked: data.rows.length,
				errors: errors,
				warning: !ok,
				ok: true
			});
		});
	}
	
	/**
	 * Removes unused views.
	 */
	deleteUnusedViews() {
		var that = this;
		var db;
		var docs = [];
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			
			return db.allDocs({
				startkey: '_',
				endkey: '_\ufff0',
				include_docs: true
			});
		})
		.then(function(data) {
			for(var i in data.rows) {
				var doc = data.rows[i].doc;
				if (doc._id == '_design/' + that.getViewDocId()) continue;
				
				console.log(' -> Deleting design document ' + doc._id);
				doc._deleted = true;
				docs.push(doc);
			}
			
			if (docs.length == 0) return Promise.reject({
				message: 'No documents to update.'
			});
			
			return db.bulkDocs(docs);
		})
		.then(function(data) {
			return Promise.resolve({
				ok: data.ok,
				message: data.message ? data.message : ('Removed ' + docs.length + ' unused design documents.')
			});
		});
	}
	
	/**
	 * Check documents metadata
	 */
	checkDocumentsMeta(allDocs) {
		return new Promise(function(resolve, reject) {
			var errors = [];
			var cnt = 0;
			
			for(var i in allDocs.rows) {
				var doc = allDocs.rows[i].doc;
				
				if (doc._id.startsWith('_')) continue;
				if (doc._id =='settings') continue;
			
				cnt++;
				Document.checkMeta(doc, errors);
			}
			
			if (!errors.length) {
				errors.push({
					message: 'No inconsistent documents found (' + cnt + ' checked)',
					type: 'S'
				});
			}
			resolve({
				numChecked: cnt,
				errors: errors,
			});
		});
	}
	
	/**
	 * Re-generate all documents meta data
	 */
	repairDocumentsMeta(ids) {
		var docs = [];
		var db;

		var that = this;
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			return db.allDocs({
				conflicts: true,
				include_docs: true,
				keys: ids,
			});
		})
		.then(function(data) {
			for(var i in data.rows) {
				var doc = data.rows[i].doc;
				if (!doc.type || !Document.isTypeValid(doc.type)) continue;
				
				Document.updateMeta(doc);
				
				console.log(' -> Update metadata for ' + doc._id);
				docs.push(doc);
			}
			
			if (docs.length == 0) return Promise.reject({
				message: 'No documents to update.'
			});
			
			return db.bulkDocs(docs);
		})
		.then(function(data) {
			return Promise.resolve({
				ok: data.ok,
				message: data.message ? data.message : ('Solved problems for ' + docs.length + ' documents')
			});
		});
	}

	/**
	 * Check documents basic props
	 */
	checkDocumentsData(allDocs) {
		return new Promise(function(resolve, reject) {
			var errors = [];
			var cnt = 0;
			
			for(var i in allDocs.rows) {
				var doc = allDocs.rows[i].doc;
				
				if (doc._id.startsWith('_')) continue;
				if (doc._id =='settings') continue;
				
				cnt++;
				Document.checkBasicProps(doc, errors, allDocs.rows);
			}
			
			if (!errors.length) {
				errors.push({
					message: 'No inconsistent documents found (' + cnt + ' checked)',
					type: 'S'
				});
			}
			
			resolve({
				numChecked: cnt,
				errors: errors,
			});
		});
	}
	
	/**
	 * Solve errors from the list of solverReceipts in the errors array.
	 */
	solveDocumentErrors(errors) {
		var ids = [];
		for(var m in errors) {
			var msg = errors[m];
			if (!msg.id) continue;
			if (!msg.solverReceipt && !msg.solver) continue;
			
			ids.push(msg.id);
		}
		ids = Tools.removeDuplicates(ids);

		var docs = [];
		var db;

		var that = this;
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			return db.allDocs({
				include_docs: true,
				keys: ids,
			});
		})
		.then(function(data) {
			for(var i in data.rows) {
				var doc = data.rows[i].doc;
				
				for(var m in errors) {
					var msg = errors[m];
					if (msg.id != doc._id) continue;
					if (!msg.solverReceipt && !msg.solver) continue;
					
					// Repair stuff
					console.log(' -> Repairing document basic data: ' + doc._id);
					Document.repairBasicData(doc, msg.solverReceipt, msg.solver);
				}
				
				docs.push(doc);
			}
			
			if (docs.length == 0) return Promise.reject({
				message: 'No documents to repair.'
			});
			
			return db.bulkDocs(docs);
		})
		.then(function(data) {
			return Promise.resolve({
				ok: data.ok,
				message: data.message ? data.message : ('Repaired ' + docs.length + ' documents')
			});
		});
	}
	
	/**
	 * Check documents basic props
	 */
	checkDocumentsConflicts(allDocs) {
		return new Promise(function(resolve, reject) {
			var errors = [];
			
			for(var i in allDocs.rows) {
				var doc = allDocs.rows[i].doc;
				
				if (doc._conflicts) {
					for (var c in doc._conflicts) {
						errors.push({
							message: 'Confict detected: ' + doc._conflicts[c],
							id: doc._id,
							type: 'E'
						});
					}
				}
			}
			
			if (!errors.length) {
				errors.push({
					message: 'No conflicted documents found (' + allDocs.rows.length + ' checked)',
					type: 'S'
				});
			}
			
			resolve({
				numChecked: allDocs.rows.length,
				errors: errors,
			});
		});
	}
	
	/**
	 * Repair documents basic props
	 */
	repairDocumentsConflicts(ids) {
		var docRevs = [];
		var db;

		var that = this;
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			return db.allDocs({
				conflicts: true,
				include_docs: true,
				keys: ids,
			});
		})
		.then(function(data) {
			for(var i in data.rows) { 
				var doc = data.rows[i].doc;
				
				if (doc._conflicts) {
					for (var c in doc._conflicts) {
						docRevs.push({
							id: doc._id,
							rev: doc._conflicts[c]
						});
					}
				}
			}
			
			var promises = [];
			for(var i in docRevs) {
				var r = docRevs[i];
				console.log(" -> Deleting conflict revision of " + r.id + ": " + r.rev);
				
				promises.push(
					db.remove(r.id, r.rev)
				);
			}
			
			return Promise.all(promises);
		})
		.then(function(data) {
			return Promise.resolve({
				ok: data.ok,
				message: 'Deleted ' + docRevs.length + ' conflict revisions'
			});
		});
	}
	
	/**
	 * Deletion of raw documents
	 */
	deleteDbDocument(id) {
		var db;
		var that = this;
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			return db.get(id);
		})
		.then(function(doc) {
			if(!doc) {
				return Promise.reject({
					message: 'Document ' + id + ' not found'
				});
			}
			return db.remove(doc);
		})
		.then(function(data) {
			return Promise.resolve({
				ok: data.ok,
				message: 'Deleted ' + id
			});
		});
	}
	
	/**
	 * Save raw document
	 */
	saveDbDocument(doc) {
		var db;
		var that = this;
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			return db.put(doc);
		})
		.then(function(data) {
			return Promise.resolve({
				ok: data.ok,
				message: 'Saved ' + doc._id
			});
		});
	}
	
	/**
	 * Check documents tree referencing
	 */
	checkDocumentsRefs(allDocs) {
		var that = this;
		return new Promise(function(resolve, reject) {
			var errors = [];
			var cnt = 0;
			
			for(var i in allDocs.rows) {
				var doc = allDocs.rows[i].doc;
				if (doc._id.startsWith('_')) continue;
				if (doc._id =='settings') continue;
				
				cnt++;
				if (!doc.type) {
					errors.push({
						message: 'Type missing (document is not displayed)',
						id: doc._id,
						type: 'E'
					});	
				}
				
				if (doc.type == 'reference') {
					if (!doc.ref) {
						errors.push({
							message: 'Ref missing for reference document',
							id: doc._id,
							type: 'E'
						});	
					} else {
						if (!that.checkRefsDocExists(allDocs.rows, doc.ref)) {
							errors.push({
								message: 'Broken reference: Target ' + doc.ref + ' does not exist',
								id: doc._id,
								type: 'E'
							});	
						}
						
						var refChildren = that.getRefChidren(allDocs.rows, doc._id);
						for (var rr in refChildren) {
							errors.push({
								message: 'Child of reference document detected: ' + refChildren[rr]._id,
								id: doc._id,
								type: 'E'
							});	
						}
					}
				}
				
				that.checkHasRoot(allDocs.rows, doc, errors, doc._id);
			}
			
			var ok = errors.length == 0;
			if (ok) {
				errors.push({
					message: 'No inconsistent documents found (' + cnt + ' checked)',
					type: 'S'
				});
			}
			resolve({
				numChecked: cnt,
				errors: errors,
			});
		});
	}
	
	/**
	 * Checks if id exists in docs. 
	 * Helper for checkDocumentsRefs().
	 */
	checkRefsDocExists(docs, id) {
		for(var i in docs) {
			var doc2 = docs[i].doc;
			if (doc2._id == id) {
				return true;
			}
		}
		return false;
	}
	
	/**
	 * Gets Children of an ID.
	 * Helper for checkDocumentsRefs().
	 */
	getRefChidren(docs, id) {
		var ret = [];
		for(var i in docs) {
			var doc2 = docs[i].doc;
			if (doc2.parent == id) {
				ret.push(doc2);
			}
		}
		return ret;
	}
	
	/**
	 * Helper for checkDocumentsRefs().
	 */
	checkHasRoot(docs, doc, errors, docId) {
		if (!doc.hasOwnProperty('parent')) {
			errors.push({
				message: 'Parent missing (document is not displayed)',
				id: doc._id,
				type: 'E'
			});	
			return false;
		}
		if (doc.parent == '') return true;
			
		if (doc.parent == doc._id) {
			errors.push({
				message: 'Self-referencing parent',
				id: doc._id,
				type: 'E'
			});	
			return false;
		}
		
		for(var i in docs) {
			if (docs[i].doc._id == doc.parent) {
				return this.checkHasRoot(docs, docs[i].doc, errors, docId);
			}
		}
		
		errors.push({
			message: 'Document has no root: (lost at ' + doc._id + ')',
			id: docId,
			type: 'E'
		});
		
		return false;
	} 
	
	/**
	 * Get document statistics
	 */
	getStats(allDocs) {
		var that = this;
		return new Promise(function(resolve, reject) {
			var errors = [];

			for(var i in allDocs.rows) {
				var doc = allDocs.rows[i].doc;
				
				errors.push({
					message: '',
					id: doc._id,
					size: that.getDocSize(doc),
					type: 'I'
				});	
			}

			errors.sort(function(a, b) { return b.size - a.size });
			
			for(var i in errors) {
				var error = errors[i];
				error.message = Tools.convertFilesize(error.size)
			}
			
			resolve({
				numChecked: allDocs.rows.length,
				errors: errors,
			});
		});
	}
	
	/**
	 * Get DB document size
	 */
	getDocSize(doc) {
		var ret = 0;
		
		// Content size
		ret += JSON.stringify(doc).length;
		
		// Attachment size (not included in JSON because attachments are stubbed)
		for(var name in doc._attachments || []) {
			if (!doc._attachments.hasOwnProperty(name)) continue;
			var att = doc._attachments[name];
			if (!att) continue;
			if (!att.length) continue;
			ret += att.length;
		}
		
		return ret;
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Registers a callback for the given action ID. The callbacks will be called after
	 * the action has taken place.
	 * 
	 * Parameters to the callback are always: (data), where data is a parameter depending on the type of action.
	 * Each callback can optionally return a promise which is waited for before continuing.
	 */
	registerCallback(processId, actionId, callback) {
		if (!this.callbacks) this.callbacks = new Map();
	
		var cb = this.callbacks.get(actionId);
		
		if (!cb) {
			cb = {};
			cb.handlers = new Map();
			this.callbacks.set(actionId, cb);
		}

		cb.handlers.set(processId, callback);
	}
	
	/**
	 * Delete all callbacks for the given processID.
	 */
	deleteCallbacks(processId) {
		for(var [actionId, list] of this.callbacks) {
			list.handlers.set(processId, null);
		}
	}
	
	/**
	 * Executes the callbacks for a given action.
	 */
	async executeCallbacks(actionId, data) {
		var cb = this.callbacks.get(actionId);
		if (!cb) return;
		
		var promises = [];
		for(var [processId, callback] of cb.handlers) {
			if (callback) {
				var p = callback(data);
				if (p) promises.push(p);
			}
		}
		
		if (promises.length > 0) {
			await Promise.all(promises);
		}
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Sets a lock for the given ID (scope is the instance). If the document is locked,
	 * it waits until the lock is free again.
	 */
	lock(id) {
		Document.lock(id);
	}
	
	/**
	 * Releases the lock of ID. Returns if the lock has been set.
	 */
	unlock(id) {
		Document.unlock(id);
	}
}
	