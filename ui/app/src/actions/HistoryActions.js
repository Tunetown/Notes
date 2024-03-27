/**
 * Actions for editors.
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

class HistoryActions {
	
	#app = null;
	
	constructor(app) {
		this.#app = app;
	}
	
	/**
	 * Show history for the note.
	 */
	async showHistory(id) {
		var db = await this.#app.db.get();
		var data = await db.get(id);
		
		await this.#app.loadPage(new VersionsPage(), data);
			
		return { ok: true };
	}
	
	/**
	 * Request to view a note history version.
	 */
	async requestVersion(id, name, callDirectly) { 
		var db = await this.#app.db.get();
		var doc = await db.get(id);
		var attData = await db.getAttachment(id, name);

		var that = this;
		return await new Promise(function(resolve, reject) {
			var reader = new FileReader();
			reader.onload = function() {
				if (callDirectly) {
					// Directly call the editor in version restore mode.
					Document.setRestoreData(id, reader.result);
					
					that.#app.routing.call(id);						

					resolve({ ok: true });
				} else {
					// Load data into the version viewer
					that.#app.loadPage(new VersionPage(), {
						id: id, 
						name: name, 
						data: reader.result, 
						doc: doc
					})
					.then(function() {
						resolve({ ok: true });
					})
					.catch(function(err) {
						reject(err);
					})
				}
			}
			
			reader.readAsText(attData);
		});
	}
	
	/**
	 * Delete note version callback
	 */
	async deleteVersion(id, name) {
		try {			
			var db = await this.#app.db.get();
		
			Document.lock(id);

			var doc = await db.get(id);
			
			var data = await db.removeAttachment(id, name, doc._rev)
	
			Document.unlock(id);
	
			if (!data.ok) {
				throw new Error(data.message);
			}
				
			await this.showHistory(id);
			
			return {
				ok: true,
				message: 'Successfully deleted version.',
				messageThreadId: 'DeleteVersionMessages'
			};
			
		} catch(err) {
			Document.unlock(id);
			
			throw err;
		}
	}

	
	/**
	 * Delete whole history of a note
	 */
	async deleteHistory(id) {
		try {
			var db = await this.#app.db.get();

			Document.lock(id);
			
			var data = await db.get(id);
	
			Document.addChangeLogEntry(data, 'deletedAllVersions', {
				numDeleted: (data._attachments || []).length
			});
	
			data._attachments = {};
				
			Document.updateMeta(data);
				
			var resp = await db.put(data);
	
			Document.unlock(id);
	
			if (!resp.ok) {
				throw new Error(data.message);
			}			
	
			return {
				ok: true
			};
			
		} catch(err) {
			Document.unlock(id);
			
			throw err;
		}
	}
}