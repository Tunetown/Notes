/**
 * Actions for reference documents.
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

class ReferenceActions {
	
	#app = null;
	#documentAccess = null;
	
	constructor(app, documentAccess) {
		this.#app = app;
		this.#documentAccess = documentAccess;
	}

	/**
	 * Sets (retargets) a new reference target. id must be a reference.
	 */
	async setReference(id, target) {
		var doc = this.#app.data.getById(id);
		if (!doc) throw new Error('Document ' + id + ' not found');
		if (doc.type != 'reference') throw new Error('Document ' + id + ' is no reference');
		
		var tdoc = this.#app.data.getById(target);
    	if (!tdoc) throw new Error('Target not found: ' + target);
		
    	await this.#documentAccess.loadDocuments([doc])

		Document.addChangeLogEntry(doc, 'referenceChanged', {
			oldRev: doc.ref,
			newRef: target
		});
		
		doc.ref = target;
		
		await this.#documentAccess.saveItem(id);
		
		return {
			ok: true,
			message: 'Saved new target for ' + doc.name + ' to ' + tdoc.name
		};
	}
	
	/**
	 * Creates a new reference for ID.
	 */
	async createReference(id, target) {
		var doc = this.#app.data.getById(id);
		if (!doc) throw new Error('Document ' + id + ' not found');
		
    	if (target == "_cancel") {
    		reject({
    			abort: true,
				message: "Action canceled.",
			});
    		return;
    	}
    	
		// Here, target can be empty for a ref at root level.
		if (target.length > 0) {
			// If there is a target, it has to really exist
			var tdoc = this.#app.data.getById(target);
        	if (!tdoc) throw new Error('Target not found: ' + target);
		}
		
		// Create new document
		var data = {
			_id: this.#app.data.generateIdFrom(doc.name),
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
		
		var db = await this.#app.db.get();
		var ret = await db.bulkDocs([data]);

		var newIds = [];
		for(var d in ret) {
			if (!ret[d].ok) throw new Error(ret[d].message);
			
			newIds.push(ret[d].id);
		}
		
		await db.allDocs({
			conflicts: true,
			include_docs: true,
			keys: newIds
		});

		// Execute callbacks and reload data
		this.#app.callbacks.executeCallbacks('createReference', newIds);
			
		await this.#app.actions.nav.requestTree();

		// Everything went fine
		return {
			ok: true,
			message: 'Successfully created ' + newIds.length + ' references.',
			newIds: newIds
		};
	}	
}