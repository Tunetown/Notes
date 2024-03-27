/**
 * Import manager class
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
class DataActions {
	
	#app = null;
	
	/**
	 * The passed importer must have at least the following methods:
	 * 
	 * process(str, sourceName): Import the passed string data. str is the 
	 *                           string data to be imported, sourceName is 
	 *                           the name of the source file. 
	 */
	constructor(app) {
		this.#app = app;
	}
	
	/**
	 * Export all documents as JSON
	 */
	async exportNotebook(exporter, ids) {
		if (!(exporter instanceof Exporter)) throw new Error('Invalid exporter');
		
		var data = await exporter.process(ids);

		return {
			ok: true,
			message: 'Exported ' + ((data && data.docs) ? data.docs.length : "[unknown]") + ' documents.'
		};
	}

	
	/**
	 * Import a given file using the passed importer.
	 */
	async importFile(file, importer) {
		if (!(importer instanceof Importer)) throw new Error('Invalid importer');
		if (!file) throw new Error('No file selected');

		var that = this;
		var content = await new Promise(function(resolve) {
			var reader = new FileReader();
			
			reader.onload = function() {
				resolve(reader.result);
			}
			
			reader.readAsText(file);
		});
		
		console.log('Received ' + Tools.convertFilesize(content.length) + ' of data from ' + file.name, 'I');
			
		await importer.process(content, file.name);
		await that.#app.actions.nav.requestTree();
	}
	
	/**
	 * Used by the importers: Import an array of documents.
	 * 
	 * importInternalDocs is optional and will also import internal docs.
	 */
	async importDocuments(docs, importInternalDocs) {
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
		
		var db = await this.#app.db.get();
		await db.bulkDocs(docsInt);

		// Execute callbacks
		this.#app.callbacks.executeCallbacks('importFinished', docsInt);
			
		return {
			ok: true,
			message: 'Successfully imported ' + docsInt.length + ' documents'
		}; 
	}
}