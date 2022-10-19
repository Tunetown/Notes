/**
 * Access to documents.
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
class DocumentAccess {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!DocumentAccess.instance) DocumentAccess.instance = new DocumentAccess();
		return DocumentAccess.instance;
	}
	
	/**
	 * Wrapper for loadDocuments() which loads the documents from the data handler itself, 
	 * and is driven by an ID array instead of an array of doc instances.
	 */
	loadDocumentsById(ids) {
		var n = Notes.getInstance();
		var d = n.getData();
		if (!d) {
			return Promise.reject({
				message: 'Data handler still uninitialized',
				messageThreadId: 'LoadDocumentMessages'
			});
		}
		
		var docs = [];
		for(var i in ids) {
			if (!ids[i]) continue;
			
			var doc = d.getById(ids[i]);
			if (!doc) {
				return Promise.reject({
					message: 'Document ' + ids[i] + ' not found',
					messageThreadId: 'LoadDocumentMessages'
				})
			}
			
			docs.push(doc);
		}
		
		return this.loadDocuments(docs);
	}
		
	/**
	 * After this, the documents are loaded fully int the data instance.
	 */
	loadDocuments(docs) {
		if (!docs) return Promise.reject({ 
			message: 'No docs passed',
			messageThreadId: 'LoadDocumentMessages' 
		});
			
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
					message: 'No documents received',
					messageThreadId: 'LoadDocumentMessages'
				});
			}
				
			// Update data
			for(var i in ids) {
				var docInput = null;
				for(var l in docs) {
					if (!docs[l]) continue;
					if (docs[l]._id == ids[i]) {
						docInput = docs[l];
						break;
					}
				}
				if (!docInput) {
					return Promise.reject({
						message: 'Document ' + ids[i] + ' not found in source data',
						messageThreadId: 'LoadDocumentMessages'
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
						message: 'Document ' + ids[i] + ' not found in loaded data',
						messageThreadId: 'LoadDocumentMessages'
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
	 * Returns a promise holding allDocs data including documents and conflicts (not attachments!), used for checks.
	 */
	getAllDocs() {
		return Database.getInstance().get()
		.then(function(db) {
			return db.allDocs({
				conflicts: true,
				include_docs: true,
			});
		})
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
	
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Deletion of raw documents (for check solvers)
	 */
	deleteDbDocument(id) {
		var db;
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			return db.get(id);
		})
		.then(function(doc) {
			if(!doc) {
				return Promise.reject({
					message: 'Document ' + id + ' not found',
					messageThreadId: 'DeleteDbDocMessages'
				});
			}
			return db.remove(doc);
		})
		.then(function(data) {
			return Promise.resolve({
				ok: data.ok,
				message: 'Deleted ' + id,
				messageThreadId: 'DeleteDbDocMessages'
			});
		});
	}
	
	/**
	 * Save raw document (for check solvers)
	 */
	saveDbDocument(doc) {
		var db;
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			return db.put(doc);
		})
		.then(function(data) {
			return Promise.resolve({
				ok: data.ok,
				message: 'Saved ' + doc._id,
				messageThreadId: 'SaveDbDocMessages'
			});
		});
	}
	
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Generic function to save an existing document on DB.
	 */
	saveItem(id) {
		if (!id) return Promise.reject({
			message: 'No ID passed',
			messageThreadId: 'SaveItemMessages'
		});
			
		var n = Notes.getInstance();
		
		var doc = n.getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found',
			messageThreadId: 'SaveItemMessages'
		});
		
		return Database.getInstance().get()
		.then(function(db) {
			Document.lock(id);

			Document.updateMeta(doc);
			
			// Save note
			return db.put(Document.clone(doc));
		})
		.then(function (dataResp) {
			Document.unlock(id);
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
			Document.unlock(id);
			return Promise.reject(err);
		}); 
	}
	
	/**
	 * Generic function to save multiple existing documents to DB. Expects an array of IDs.
	 */
	saveItems(ids) {
		if (!ids) return Promise.reject({ 
			message: 'No docs passed',
			messageThreadId: 'SaveItemsMessages'
		});
		var n = Notes.getInstance();
			
		// Remove duplicates
		ids = Tools.removeDuplicates(ids);

		// Collect and lock documents
		var docs = [];
		for (var l in ids) {
			Document.lock(ids[l]);
			
			var doc = n.getData().getById(ids[l]);
			if (!doc) {
				return Promise.reject({
					message: 'Document ' + ids[l] + ' not found',
					messageThreadId: 'SaveItemsMessages'
				});
			}
			
			Document.updateMeta(doc);
			docs.push(Document.clone(doc));
		}
		
		// Save them
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
						message: 'Document ' + data[i].id + ' not found in loaded data',
						messageThreadId: 'SaveItemsMessages'
					});
				}
				
				dd._rev = data[i].rev;
				Document.update(dd, dd);
			}
			
			// Unlock
			for(var i in ids) {
				Document.unlock(ids[i]);
			}

			return Promise.resolve({
				ok: true
			});
		})
		.catch(function(err) {
			// Unlock
			for(var i in ids) {
				Document.unlock(ids[i]);
			}
			return Promise.reject(err);
		}); 
	}

	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	/**
	 * Import an array of documents
	 */
	importDocuments(docs) {
		for(var i in docs) {
			var doc = docs[i];
			Document.updateMeta(doc);
		}
		
		var db;
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			
			return db.bulkDocs(docs);
		})
		.then(function(/*data*/) {
			// Execute callbacks
			Callbacks.getInstance().executeCallbacks('importFinished', docs);
			
			return Promise.resolve({
				ok: true,
				message: 'Successfully imported ' + docs.length + ' documents',
				messageThreadId: 'ImportDocsMessages'
			});
		}); 
	}
		
	/**
	 * Export (download) documents. Expects an array of IDs.
	 */
	exportDocuments(ids) {
		var db;
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
					message: "Error: No data received.",
					messageThreadId: 'ExportDocsMessages'
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
	
	/**
	 * Export (download) documents as ZIP file. Expects an array of IDs.
	 */
	exportDocumentsToObsidian(ids) {
		var db;
		var _data;
		var docsPrepped = [];
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
			_data = data;
			if (!_data.rows) {
				return Promise.reject({
					message: "Error: No data received.",
					messageThreadId: 'ExportDocsMessages'
				})
			}
			
			// Load all attachments first, and also add links in the contents.
			var filenames = [];
			var promises = [];
			var nonDocFolders = 0;
			for(var i in _data.rows) {
				var doc = _data.rows[i].doc;
				
				var path = Notes.getInstance().getData().getFilePath(doc._id);
				if (path[0] == '/') path = path.substring(1);
				
				var hasChildren = Notes.getInstance().getData().hasChildren(doc._id);
				if (hasChildren) {
					path += '_CONTENT';
				}
				
				var content = "";
				var skip = false;
				switch (doc.type) {
					case 'note': {
						content = doc.content;
						path += '.md';
						break;
					}
					case 'reference': {
						// TODO	
						console.log('ERROR: Refs not implemented yet: ' + doc._id);	
						skip = true;				
						break;
					}
					case 'sheet': {
						console.log('WARNING: Sheets are not exported properly (just as plain text MD): ' + path);
						content = doc.content;
						path += '.md';
						break;
					}
					case 'attachment': {
						if (doc.name != doc.attachment_filename) {
							path += ' - ' + doc.attachment_filename;  // TODO Could be more convenient...
						}
						
						promises.push(
							AttachmentActions.getInstance().getAttachmentUrl(doc._id)
							.then(function(ret) {
								var found = false;
								for(var j=0; j<docsPrepped.length; ++j) {
									if (docsPrepped[j].id == ret.id) {
										docsPrepped[j].content = ret.blob;
										found = true;
										break;
									}
								}
								if (!found) {
									console.log("ERROR: Attachment " + ret.id + " failed to load");
								}
								return Promise.resolve();
							})
						);
						break;
					}
				}
				
				// TODO: (Not clear in Obsidian!)
				// - Background Images and colors
				// - order
				// - labels
				
				/*if ((doc.type != 'attachment') && !content && hasChildren) {
					//console.log('Folder has no document content, skipping ' + path);
					++nonDocFolders;
					skip = true;	
				}*/
				
				if (skip) continue;
				
				// Check for duplicate file names
				var filename = Tools.removeFileExtension(Tools.extractFilename(path));
				var basefilename = filename;
				var dupi = 0;
				while(filenames.findIndex(function(e) { return (e == filename); }) >= 0) {
					console.log(' -> Name collision: ' + filename);

					dupi++;
					filename = basefilename + ' (' + dupi + ')'; //Tools.replaceFileName(Tools.extractFilename(path), Tools.escapeFilename(doc.name) + ' (' + dupi + ')');
				}
				path = Tools.replaceFileName(path, filename);
				filenames.push(filename);

				console.log('Exporting ' + path);
				docsPrepped.push({
					id: doc._id,
					path: path,
					filename: filename,
					doc: doc,
					content: content,
					lastModified: new Date()
				});
			}
			
			for(var i=0; i<docsPrepped.length; ++i) {
				var links = [];
				var dp = docsPrepped[i];
				
				// Parent: Add a link to all documents pointing to their parents
				if (dp.doc.parent) {
					var found = false;
					for(var j=0; j<docsPrepped.length; ++j) {
						if (docsPrepped[j].id == dp.doc.parent) {
							links.push(docsPrepped[j].filename);			
							
							found = true;
							break;
						}
					}
					if (!found) {
						console.log('ERROR: Parent does not exist for ' + dp.id);
					}
				}
				
				// References: Add a link at the referenced document, pointing to the parent.
				
				// TODO
				
				docsPrepped[i].links = links;
			}
			
			// Add all links at the start of the content
			for(var i=0; i<docsPrepped.length; ++i) {
				// TODO
				var ltext = "";
				for(var l=0;l<docsPrepped[i].links.length; ++l) {
					ltext += "[[" + docsPrepped[i].links[l] + "]] ";
				}
				if (!ltext) continue;
				
				docsPrepped[i].content = ltext + '\n\n' + docsPrepped[i].content; 
			}
			
			console.log(' -> Exported ' + docsPrepped.length + ' file documents');
			console.log('   -> ' + nonDocFolders + ' non-document folders skipped');
			console.log('     -> ' + (_data.rows.length - docsPrepped.length - nonDocFolders) + ' unexported documents left');
			
			return Promise.all(promises);
		})
		.then(function(/*attPromises*/) {
			var files = [];
			
			console.log('Creating ZIP containing  ' + docsPrepped.length + ' documents');
			for(var i=0; i<docsPrepped.length; ++i) {
				var dp = docsPrepped[i];

				files.push({
					name: dp.path,
					lastModified: dp.lastModified,
					input: dp.content
				});
			}
			
			// get the ZIP stream in a Blob
			return downloadZip(files).blob();
		})
		.then(function(blob) {
			// make and click a temporary link to download the Blob
			var url = URL.createObjectURL(blob);
			
			window.saveAs(url, 'Notes Export ' + new Date().toLocaleString() + '.zip');
			
			return Promise.resolve({
				ok: true
			});
		}); 
	}
}