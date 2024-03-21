/**
 * Importer for JSON raw data.
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
class NotesImporter {
	
	#app = null;
	#defaults = null;
	
	constructor(app, defaults) {
		this.#app = app;
		
		this.#defaults = defaults ? defaults : {};
	}
	  
	/**
	 * Initialize the importer (add options etc)
	 */
	initialize() {
		$('#importOptionsContainer').append(
			$('<table class="importOptionsTable"></table>').append(
				$('<tbody></tbody>').append(
					$('<tr></tr>').append(
						$('<td>Import internal meta/settings</td>'),
						$('<td></td>').append(
							$('<input type="checkbox" id="importInternal" ' + (this.#defaults.importInternal ? 'checked' : '') + ' />')	
						)
					),
					$('<tr></tr>').append(
						$('<td>Create new IDs before importing</td>'),
						$('<td></td>').append(
							$('<input type="checkbox" id="createIds" ' + (this.#defaults.createIds ? 'checked' : '') + ' />')	
						)
					),
					$('<tr></tr>').append(
						$('<td>Create a new root item for the imported documents</td>'),
						$('<td></td>').append(
							$('<input type="checkbox" id="useRootItem" ' + (this.#defaults.useRootItem ? 'checked' : '') + ' />')	
						)
					)
				)
			)
		);
	}
	
	/**
	 * Returns an options array.
	 */
	parseOptions() {
		return {
			importInternal: !!$('#importInternal').is(':checked'),
			createIds: !!$('#createIds').is(':checked'),
			useRootItem: !!$('#useRootItem').is(':checked')
		};
	}
	
	/**
	 * Import the passed string data as raw JSON board data.
	 */
	async process(jsonString, sourceName) {
		if (!jsonString) {
			return Promise.reject({
				message: 'No data to import',
				messageThreadId: 'ImportProcessMessages'
			});
		}
		if (!sourceName) {
			return Promise.reject({
				message: 'No root item name to import to',
				messageThreadId: 'ImportProcessMessages'
			});
		}
		
		var options = this.parseOptions();

		var d = this.#app.data;
		var data = JSON.parse(jsonString);
		
		// Prepare for existing IDs. This is done in the original jsonString, which is then re-parsed.
		for(var i in data) {
			var doc = data[i];
			
			console.log(' -> Importing ' + doc.name + ' (' + Tools.convertFilesize(JSON.stringify(doc).length) + ')');
				
			if (NotesExporter.isInternalDocument(doc._id)) {
				console.log(" -> Internal file, keeping id: " + doc._id);
				continue;
			}
			
			if (!options.createIds) {
				// Check if exists, and throw an error if yes
				var tmp = d.getById(doc._id);
				if (tmp) throw new Error('Document with ID ' + doc._id + ' already exists, cancelling import.');
				
				continue;
			}	
			
			// All IDs are renewed
			var newId = d.generateIdFrom(doc.name);
			console.log('    New ID for ' + doc._id + ': ' + newId, 'W');
			jsonString = jsonString.replaceAll('"' + doc._id + '"', '"' + newId + '"');
		}
		
		// Parse data again, now that the IDs should all be unique
		data = JSON.parse(jsonString);
		
		// Root item
		var rootId = d.generateIdFrom(sourceName);
		var root = {
			_id: rootId,
			name: sourceName,
			type: 'note',
			parent: '',
			content: '',
			timestamp: Date.now(),
		};
		
		// Set all parents not occurring in the imported data to the new root item
		for(var i in data) {
			var doc = data[i];
			delete doc._rev;
			
			if (NotesExporter.isInternalDocument(doc._id)) {
				console.log(" -> Internal file OK: " + doc._id);
				continue;
			}
			
			if (!doc.parent) {
				if (options.useRootItem) {
					// Root items go directly under the new root item
					console.log(' -> Set parent to new root item: ' + doc.name);
					doc.parent = rootId;					
				} else {
					console.log(' -> Checked OK (root item): ' + doc.name);
				}
			} else {
				var found = false;
				for(var d in data) {
					if (data[d]._id == doc.parent) {
						found = true;
						break;
					}
				}
				if (!found) {
					if (options.useRootItem) {
						console.log(' -> Parent ' + doc.parent + ' not found for ' + doc.name + ', putting into new root');
						doc.parent = rootId;
					} else {
						console.log(' -> Parent ' + doc.parent + ' not found for ' + doc.name + ', putting into root');
						doc.parent = '';
					}
				} else {
					console.log(' -> Checked OK: ' + doc.name);
				}
			}
		}
		
		if (options.useRootItem) {
			// Now finally add the root item
			data.push(root);
		}
		
		console.log(' -> Documents to import: ' + data.length, 'I');

		if (!confirm('Do you want to import ' + data.length + ' documents holding ' + Tools.convertFilesize(jsonString.length) + ' of data?')) {
			return Promise.reject({
				message: 'Import cancelled',
				messageThreadId: 'ImportProcessMessages',
				abort: true
			});
		}

		return NotesImporter.importDocuments(this.#app, data, options.importInternal)
		.then(function(data) {
			if (!data.ok) {
				console.log('Error in import: ' + data.message, 'E');
				return Promise.reject(data);
			}
			
			console.log('Finished import.', 'S');
			return Promise.resolve({
				message: 'Finished import.',
				messageThreadId: 'ImportProcessMessages',
				ok: true,
				docNct: data.length,
			});
		});
	}	
	
	/**
	 * Import an array of documents
	 */
	static importDocuments(app, docs, importInternalDocs) {
		var docsInt = [];
		
		for(var i in docs) {
			if (NotesExporter.isDesignDocument(docs[i]._id)) {
				continue;
			}
			
			if (NotesExporter.isInternalDocument(docs[i]._id)) {
				if (importInternalDocs) { 
					docsInt.push(docs[i]);
				}
				continue;
			} 
			
			Document.updateMeta(docs[i]);
			docsInt.push(Document.clone(docs[i]));							
		}
		
		var db;
		return app.db.get()
		.then(function(dbRef) {
			db = dbRef;
			
			return db.bulkDocs(docsInt);
		})
		.then(function(/*data*/) {
			// Execute callbacks
			app.callbacks.executeCallbacks('importFinished', docsInt);
			
			return Promise.resolve({
				ok: true,
				message: 'Successfully imported ' + docsInt.length + ' documents',
				messageThreadId: 'ImportDocsMessages'
			});
		}); 
	}
}