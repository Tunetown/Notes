/**
 * Export as raw data
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
class NotesExporter {
	
	#app = null;
	
	constructor(app) {
		this.#app = app;
	}
	
	/**
	 * Export (download) documents. Expects an array of IDs.
	 */
	export(ids) {
		var db;
		
		var that = this;
		return this.#app.db.get()
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
					message: "No data received.",
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

			window.saveAs(url, that.#app.settings.settings.dbAccountName + ' Raw Export ' + new Date().toLocaleString() + '.txt');
			
			return Promise.resolve({
				ok: true
			});
		}); 
	}
	
	/**
	 * Export (download) the whole database, including internal documents.
	 */
	exportDatabase() {
		var db;
		
		var that = this;
		return this.#app.get()
		.then(function(dbRef) {
			db = dbRef;
			
			return db.allDocs({
				conflicts: true,
				include_docs: true,
				attachments: true
			});
		})
		.then(function(data) {
			if (!data.rows) {
				return Promise.reject({
					message: "No data received.",
					messageThreadId: 'ExportDocsMessages'
				})
			}
			
			var docs = [];
			for(var i in data.rows) {
				if ((!data.rows[i].doc._id) || NotesExporter.isDesignDocument(data.rows[i].doc._id)) continue;
				
				docs.push(data.rows[i].doc);
			}
			
			//docs.sort(function(a, b){ return a._id < b._id; });
			
			var dataString = JSON.stringify(docs);
			var dataBlob = new Blob([dataString], {type: 'text/plain'});
			var url = URL.createObjectURL(dataBlob);
			
			// For debugging
			console.log(' -> ' + Tools.convertFilesize(dataString.length) + ' of data loaded in export request');

			window.saveAs(url, that.#app.settings.settings.dbAccountName + ' Raw Export ' + new Date().toLocaleString() + '.txt');
			
			return Promise.resolve({
				ok: true,
				docs: docs
			});
		}); 
	}
	
	/**
	 * Returns if the document is internal.  TODO move somewhere else?
	 */
	static isInternalDocument(id) {     // #IGNORE static
		if (!id) return false;
		
		return NotesExporter.isDesignDocument(id) || (id == SettingsActions.settingsDocId) || (id == MetaActions.metaDocId);
	}

	/**
	 * Returns if the document is internal.   TODO move somewhere else?
	 */
	static isDesignDocument(id) {        // #IGNORE static
		if (!id) return false;
		
		return id.startsWith("_");
	}
}