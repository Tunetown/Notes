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
class NotesImporter extends Importer {
	
	#defaults = null;
	
	constructor(app, defaults) {
		super(app);
		
		this.#defaults = defaults ? defaults : {};
	}
	
	/**
	 * Returns the option definitions for the importer, if any.
	 * 
	 * Returns an array of objects (all attributes are mandatory):
	 * [
	 *     {
	 *         id: Unique ID for the option
	 *         type: checkbox is the only available type until now
	 *         text: label text for the option
	 *         defaultValue: default value for the option
	 *     }
	 * ]
	 */
	getOptionDefinitions() {
		return [
			{
				id: 'importInternal',
				type: 'checkbox',
				text: 'Import internal meta/settings',
				defaultValue: this.#defaults.importInternal
			},
			{
				id: 'createIds',
				type: 'checkbox',
				text: 'Create new IDs before importing',
				defaultValue: this.#defaults.createIds
			},
			{
				id: 'useRootItem',
				type: 'checkbox',
				text: 'Create a new root item for the imported documents',
				defaultValue: this.#defaults.useRootItem
			}


		];
	}
	
	/**
	 * Import the passed string data as raw JSON board data.
	 */
	async process(jsonString, sourceName) {
		if (!jsonString) throw new Error('No data to import');
		if (!sourceName) throw new Error('No root item name to import to');
		
		var d = this._app.data;
		var data = JSON.parse(jsonString);
		
		// Prepare for existing IDs. This is done in the original jsonString, which is then re-parsed.
		for(var i in data) {
			var doc = data[i];
			
			console.log(' -> Importing ' + doc.name + ' (' + Tools.convertFilesize(JSON.stringify(doc).length) + ')');
				
			if (NotesExporter.isInternalDocument(doc._id)) {
				console.log(" -> Internal file, keeping id: " + doc._id);
				continue;
			}
			
			if (!this.getOption('createIds')) {
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
				if (this.getOption('useRootItem')) {
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
					if (this.getOption('useRootItem')) {
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
		
		if (this.getOption('useRootItem')) {
			// Now finally add the root item
			data.push(root);
		}
		
		console.log(' -> Documents to import: ' + data.length);

		var answer = await this._app.view.getDialog().confirm('Do you want to import ' + data.length + ' documents holding ' + Tools.convertFilesize(jsonString.length) + ' of data?');
		if (!answer) {
			throw new InfoError('Import canceled');
		}

		var data = await this._app.actions.data.importDocuments(data, this.getOption('importInternal'))

		console.log('Finished import.');
		
		return {
			ok: true,
			docCount: data.length,
		};
	}	
}