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
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!HistoryActions.instance) HistoryActions.instance = new HistoryActions();
		return HistoryActions.instance;
	}
	
	/**
	 * Show history for the note.
	 */
	showHistory(id) {
		return Database.getInstance().get()
		.then(function(db) {
			return db.get(id);
		})
		.then(function (data) {
			var v = Versions.getInstance();
			v.load(data);
			
			return Promise.resolve({ ok: true });
		});
	}
	
	/**
	 * Request to view a note history version
	 */
	requestVersion(id, name) { 
		var db;
		var doc;
		
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			return db.get(id);
		})
		.then(function (data) {
			doc = data;
			return db.getAttachment(id, name);
		})
		.then(function (attData) {
			return new Promise(function(resolve, reject) {
				var reader = new FileReader();
				reader.onload = function() {
					// Load data into the version viewer
					VersionView.getInstance().load(id, name, reader.result, doc);
					
					resolve({
						ok: true
					});
				}
				
				reader.readAsText(attData);
			});
		});
	}
	
	/**
	 * Delete note version callback
	 */
	deleteVersion(id, name) {
		var db;
		var that = this;
		
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			Document.lock(id);
			
			return db.get(id);
		})
		.then(function (data) {
			return db.removeAttachment(id, name, data._rev)
		})
		.then(function (data) {
			if (!data.ok) {
				Document.unlock(id);
				
				return Promise.reject({
					message: data.message,
					messageThreadId: 'DeleteVersionMessages'
				});
			}
			
			Document.unlock(id);
			return that.showHistory(id);
		})
		.then(function (/*data*/) {
			return Promise.resolve({
				ok: true,
				message: 'Successfully deleted version.',
				messageThreadId: 'DeleteVersionMessages'
			});
		})
		.catch(function(err) {
			Document.unlock(id);
			return Promise.reject(err);
		});
	}

	
	/**
	 * Delete whole history of a note
	 */
	deleteHistory(id) {
		var db;
		
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			Document.lock(id);
			
			return db.get(id);
		})
		.then(function (data) {
			Document.addChangeLogEntry(data, 'deletedAllVersions', {
				numDeleted: (data._attachments || []).length
			});

			data._attachments = {};
			
			Document.updateMeta(data);
			
			return db.put(data);
		})
		.then(function (data) {
			if (!data.ok) {
				Document.unlock(id);
				
				return Promise.reject({
					message: data.message,
					messageThreadId: 'DeleteHistoryMessages'
				});
			}
			
			Document.unlock(id);
			
			return Promise.resolve({
				ok: true
			});
		})
		.catch(function(err) {
			Document.unlock(id);
			
			return Promise.reject(err);
		});
	}
}