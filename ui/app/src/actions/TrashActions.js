/**
 * Actions for trash.
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
class TrashActions {
	
	#app = null;
	
	constructor(app) {
		this.#app = app;
	}
	
	/**
	 * Shows the trash bin window.
	 */
	async showTrash() {
		var db = await this.#app.db.get();
			
		var data = await db.query(this.#app.views.getViewDocId() + '/deleted', {
			include_docs: true
		});

		if (!data.rows) {
			return {
				ok: true,
				message: "Trash is empty.",
			};
		}
		
		this.#app.loadPage(new TrashPage(), data.rows);
		
		return { ok: true };
	}
	
	
	/**
	 * Requests to empty the trash.
	 */
	async emptyTrash() {
		var db = await this.#app.db.get();
		
		var data = await db.query(this.#app.views.getViewDocId() + '/deleted', {
			include_docs: true
		});

		if (!confirm("Permanently delete " + data.rows.length + " trashed items?")) {  // TODO move to UI!
			throw new InfoError("Nothing changed.");
		}
		
		var docs = [];
		for(var i in data.rows) {
			data.rows[i].doc._deleted = true;
			docs.push(data.rows[i].doc);
		}
			
		await db.bulkDocs(docs);
		await this.showTrash();
			
		return {
			ok: true,
			message: "Trash is now empty.",
		};
	}
	
	/**
	 * Returns all trashed documents
	 */
	async getTrash() {
		var db = await this.#app.db.get();
		return await db.query(this.#app.views.getViewDocId() + '/deleted', {
			include_docs: true
		});
	}
	
	/**
	 * Returns a trashed document, or null if not found.
	 */
	async getTrashedDocument(id) {
		var data = await this.getTrash();

		if (!data.rows) return null;
			
		for(var i in data.rows) {
			if (!data.rows[i].doc.deleted) continue;
			
			if (data.rows[i].doc._id == id) {
				return data.rows[i].doc;
			}
		}
		
		return null;
	}
}