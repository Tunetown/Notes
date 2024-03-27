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
class NotesExporter extends Exporter {
	
	/**
	 * Export (download) documents. Expects an array of IDs.
	 */
	async process(ids) {
		var db = await this._app.get();
		var data = await db.allDocs({
			conflicts: true,
			include_docs: true,
			attachments: true,
			keys: ids
		});

		if (!data.rows) throw new Error("No data received.");
			
		var docs = [];
		for(var i in data.rows) {
			if ((!data.rows[i].doc._id) || NotesExporter.isDesignDocument(data.rows[i].doc._id)) continue;
			
			docs.push(data.rows[i].doc);
		}
			
		var dataString = JSON.stringify(docs);
		var dataBlob = new Blob([dataString], {type: 'text/plain'});
		var url = URL.createObjectURL(dataBlob);
			
		console.log(' -> ' + Tools.convertFilesize(dataString.length) + ' of data loaded in export request');

		window.saveAs(url, this._app.settings.settings.dbAccountName + ' Raw Export ' + new Date().toLocaleString() + '.txt');
			
		return {
			ok: true,
			docs: docs
		};
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