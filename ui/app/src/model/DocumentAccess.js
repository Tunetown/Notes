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
	async loadDocumentsById(ids) {
		var d = this.#app.data;
		if (!d) throw new Error('Data handler still uninitialized');
		
		var docs = [];
		for(var i in ids) {
			if (!ids[i]) continue;
			
			var doc = d.getById(ids[i]);
			if (!doc) throw new Error('Document ' + ids[i] + ' not found');
			
			docs.push(doc);
		}
		
		return await this.loadDocuments(docs);
	}
		
	/**
	 * After this, the documents are loaded fully into the data instance.
	 */
	async loadDocuments(docs) {
		if (!docs) throw new Error('No docs passed');
			
		var ids = [];
		for(var i in docs) {
			if (!docs[i]) continue;
			if (Document.isLoaded(docs[i])) continue;
			ids.push(docs[i]._id);
		}
		ids = Tools.removeDuplicates(ids);
		
		if (ids.length == 0) {
			for(var i in docs) {
				Document.invalidMetaWarning(docs[i]);
			}
			
			return Promise.resolve({
				ok: true,
				updatedIds: ids
			});
		}
		
		var db = await this.#app.db.get();
		var data = await db.allDocs({
			conflicts: true,
			include_docs: true,
			keys: ids
		});

		if (!data.rows) throw new Error('No documents received');
			
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
			if (!docInput) throw new Error('Document ' + ids[i] + ' not found in source data');
			
			var docLoaded = null;
			for(var l in data.rows) {
				if (data.rows[l].doc._id == ids[i]) {
					docLoaded = data.rows[l].doc;
					break;
				}
			}
			if (!docLoaded) throw new Error('Document ' + ids[i] + ' not found in loaded data');

			Document.update(docInput, docLoaded);
			Document.setLoaded(docInput);
			
			Document.invalidMetaWarning(docInput);
		}
		
		// For debugging
		console.log(" -> Loaded " + Tools.convertFilesize(JSON.stringify(data).length) + " (" + ids.length + " documents)");
		
		return {
			ok: true,
			updatedIds: ids
		};
	}
	
	/**
	 * Load all documents
	 */
	async loadAllDocuments() {
		var all = [];
		this.#app.data.each(function(doc) {
			all.push(doc);
		});
		
		return await this.loadDocuments(all);
	}
	
	/**
	 * Returns a promise holding allDocs data including documents and conflicts (not attachments!), used for checks.
	 */
	async getAllDocs() {
		var db = await this.#app.db.get();

		return await db.allDocs({
			conflicts: true,
			include_docs: true,
		});
	}
	
	/**
	 * Get document statistics
	 */
	async getStats(allDocs) {
		var errors = [];

		for(var i in allDocs.rows) {
			var doc = allDocs.rows[i].doc;
			
			errors.push({
				message: '',
				id: doc._id,
				size: this.#getDocSize(doc),
				type: 'I'
			});	
		}

		errors.sort(function(a, b) { return b.size - a.size });
		
		for(var i in errors) {
			var error = errors[i];
			error.message = Tools.convertFilesize(error.size)
		}
		
		return {
			numChecked: allDocs.rows.length,
			errors: errors,
		};
	}
	
	/**
	 * Get DB document size
	 */
	#getDocSize(doc) {
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
	async deleteDbDocument(id) {
		this.#app.data.resetBacklinks();
		this.#app.data.resetChildrenBuffers();
		
		var db = await this.#app.db.get();

		var doc = db.get(id);

		if(!doc) throw new Error('Document ' + id + ' not found');

		var data = await db.remove(doc);

		return {
			ok: data.ok,
			message: 'Deleted ' + id
		};
	}
	
	/**
	 * Save raw document (for check solvers)
	 */
	async saveDbDocument(doc) {
		this.#app.data.resetBacklinks();
		this.#app.data.resetChildrenBuffers();
		
		var db = await this.#app.db.get();
		var data = await db.put(doc);

		return {
			ok: data.ok,
			message: 'Saved ' + doc._id
		};
	}
	
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Generic function to save an existing document on DB.
	 */
	async saveItem(id, dontResetChildrenBuffers) {
		if (!id) throw new Error('No ID passed');
			
		var doc = this.#app.data.getById(id);
		if (!doc) throw new Error('Document ' + id + ' not found');
		
		this.#app.data.resetBacklinks();
		if (!dontResetChildrenBuffers) this.#app.data.resetChildrenBuffers();
		
		var db = await this.#app.db.get();

		try {
			Document.lock(id);
	
			Document.updateMeta(doc);
				
				// Save note
			var dataResp = await db.put(Document.clone(doc));
	
			Document.unlock(id);
			
			if (!dataResp.ok) {
				throw new Error(dataResp);
			}
			
			doc._rev = dataResp.rev;
			Document.update(doc, doc);
			
			return { ok: true };
			
		} catch(err) {
			Document.unlock(id);
			
			throw err;
		} 
	}
	
	/**
	 * Generic function to save multiple existing documents to DB. Expects an array of IDs.
	 */
	async saveItems(ids) {
		if (!ids) throw new Error('No docs passed');
			
		this.#app.data.resetBacklinks();
		this.#app.data.resetChildrenBuffers();
			
		// Remove duplicates
		ids = Tools.removeDuplicates(ids);

		try {
			// Collect and lock documents
			var docs = [];
			for (var l in ids) {
				if (!ids[l]) throw new Error('Empty ID passed');
	
				Document.lock(ids[l]);
				
				var doc = this.#app.data.getById(ids[l]);
				if (!doc) throw new Error('Document ' + ids[l] + ' not found');
				
				Document.updateMeta(doc);
				docs.push(Document.clone(doc));
			}
			
			// Save them
			var db = await this.#app.db.get();
			var data = await db.bulkDocs(docs);
	
			// Update revisions
			var d = this.#app.data;
			for(var i in data || []) {
				var dd = d.getById(data[i].id);
				if (!dd) throw new Error('Document ' + data[i].id + ' not found in loaded data');
				
				dd._rev = data[i].rev;
				Document.update(dd, dd);
			}
			
			// Unlock
			for(var i in ids) {
				Document.unlock(ids[i]);
			}
	
			return { ok: true };
			
		} catch(err) {
			// Unlock
			for(var i in ids) {
				Document.unlock(ids[i]);
			}
			
			throw err;
		} 
	}
}