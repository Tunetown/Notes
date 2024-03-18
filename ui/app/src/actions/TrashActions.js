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
	#documentAccess = null;
	
	constructor(app, documentAccess) {
		this.#app = app;
		this.#documentAccess = documentAccess;
	}
	
	/**
	 * Shows the trash bin window.
	 */
	showTrash() {
		var db;
		var that = this;
		return this.#app.db.get()
		.then(function(dbRef) {
			db = dbRef;
			return db.query(that.#app.views.getViewDocId() + '/deleted', {
				include_docs: true
			});
		})
		.then(function (data) {
			if (!data.rows) {
				return Promise.resolve({
					ok: true,
					message: "Trash is empty.",
					messageThreadId: 'ShowTrashMessages'
				});
			}
			
			that.#app.loadPage(new TrashPage(data.rows));
			
			return Promise.resolve({
				ok: true
			});
		});	
	}
	
	
	/**
	 * Requests to empty the trash.
	 */
	emptyTrash() {
		var n = Notes.getInstance();
		var db;

		var that = this;
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			return db.query(Views.getInstance().getViewDocId() + '/deleted', {
				include_docs: true
			});
		})
		.then(function (data) {
			if (!confirm("Permanently delete " + data.rows.length + " trashed items?")) {
				return Promise.reject({
					abort: true,
					message: "Nothing changed.",
					messageThreadId: 'EmptyTrashMessages'
				});
			}
			
			var docs = [];
			for(var i in data.rows) {
				data.rows[i].doc._deleted = true;
				docs.push(data.rows[i].doc);
			}
			
			return db.bulkDocs(docs);
		})
		.then(function (/*data*/) {
			n.resetPage();
			return that.showTrash();
		})
		.then(function (/*data*/) {
			return Promise.resolve({
				ok: true,
				message: "Trash is now empty.",
				messageThreadId: 'EmptyTrashMessages'
			});
		});
	}

}