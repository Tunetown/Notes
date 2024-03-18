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
	
	#app = null;
	
	constructor(app) {
		this.#app = app;
	}
	
	/**
	 * Wrapper for loadDocuments() which loads the documents from the data handler itself, 
	 * and is driven by an ID array instead of an array of doc instances.
	 */
	loadDocumentsById(ids) {
		var d = this.#app.getData();
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
	 * After this, the documents are loaded fully into the data instance.
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
			
			for(var i in docs) {
				Document.invalidMetaWarning(docs[i]);
			}
			
			return Promise.resolve({
				ok: true,
				updatedIds: ids
			});
		}
		
		return this.#app.db.get()
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
				
				Document.invalidMetaWarning(docInput);
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
		this.#app.getData().each(function(doc) {
			all.push(doc);
		});
		
		return this.loadDocuments(all);
	}
	
	/**
	 * Returns a promise holding allDocs data including documents and conflicts (not attachments!), used for checks.
	 */
	getAllDocs() {
		return this.#app.db.get()
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
		this.#app.getData().resetBacklinks();
		this.#app.getData().resetChildrenBuffers();
		
		var db;
		return this.#app.db.get()
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
		this.#app.getData().resetBacklinks();
		this.#app.getData().resetChildrenBuffers();
		
		var db;
		return this.#app.db.get()
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
	saveItem(id, dontResetChildrenBuffers) {
		if (!id) return Promise.reject({
			message: 'No ID passed',
			messageThreadId: 'SaveItemMessages'
		});
			
		var doc = this.#app.getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found',
			messageThreadId: 'SaveItemMessages'
		});
		
		this.#app.getData().resetBacklinks();
		if (!dontResetChildrenBuffers) this.#app.getData().resetChildrenBuffers();
		
		return this.#app.db.get()
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
			
		this.#app.getData().resetBacklinks();
		this.#app.getData().resetChildrenBuffers();
			
		// Remove duplicates
		ids = Tools.removeDuplicates(ids);

		// Collect and lock documents
		var docs = [];
		for (var l in ids) {
			if (!ids[l]) {
				return Promise.reject({
					message: 'Empty ID passed',
					messageThreadId: 'SaveItemsMessages'
				});
			}
			Document.lock(ids[l]);
			
			var doc = this.#app.getData().getById(ids[l]);
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
		var that = this;
		return this.#app.db.get()
		.then(function(db) {
			return db.bulkDocs(docs);
		})
		.then(function (data) {
			// Update revisions
			var d = that.#app.getData();
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
}