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
	
	/**
	 * Initialize the importer (add options etc)
	 */
	initialize() {
	}
	
	/**
	 * Import the passed string data as Trello JSON board data.
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
		
		var d = Notes.getInstance().getData();
		var data = JSON.parse(jsonString);
		
		// Prepare for existing IDs. This is done in the original jsonString, which is then re-parsed.
		for(var i in data) {
			var doc = data[i];
			Console.log(' -> Importing ' + doc.name + ' (' + Tools.convertFilesize(JSON.stringify(doc).length) + ')');
			
			// All IDs are renewed
			var newId = d.generateIdFrom(doc.name);
			Console.log('    New ID for ' + doc._id + ': ' + newId, 'W');
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
			
			if (!doc.parent) {
				// Root items go directly under the new root item
				Console.log(' -> Put root item to import node: ' + doc.name);
				doc.parent = rootId;
			} else {
				var found = false;
				for(var d in data) {
					if (data[d]._id == doc.parent) {
						found = true;
						break;
					}
				}
				if (!found) {
					Console.log(' -> Put root item to import node (parent ' + doc.parent + ' not found): ' + doc.name);
					doc.parent = rootId;
				} else {
					Console.log(' -> Root OK: ' + doc.name);
				}
			}
		}
		
		// Now finally add the root item
		data.push(root);
		
		Console.log(' -> Documents to import: ' + data.length, 'I');

		if (!confirm('Do you want to import ' + data.length + ' documents holding ' + Tools.convertFilesize(jsonString.length) + ' of data?')) {
			return Promise.reject({
				message: 'Import cancelled',
				messageThreadId: 'ImportProcessMessages',
				abort: true
			});
		}

		return DocumentAccess.getInstance().importDocuments(data)
		.then(function(data) {
			if (!data.ok) {
				Console.log('Error in import: ' + data.message, 'E');
				return Promise.reject(data);
			}
			
			Console.log('Finished import.', 'S');
			return Promise.resolve({
				message: 'Finished import.',
				messageThreadId: 'ImportProcessMessages',
				ok: true,
				docNct: data.length,
			});
		});
	}	
}