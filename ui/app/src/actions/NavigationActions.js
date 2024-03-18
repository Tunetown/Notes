/**
 * Actions for the data/navigation tree.
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
class NavigationActions {
	
	#app = null;
	#documentAccess = null;
	
	constructor(app, documentAccess) {
		this.#app = app;
		this.#documentAccess = documentAccess;
	}
	
	/**
	 * Request the note tree, and set the tree view accordingly.
	 */
	requestTree() {
		var db;
		var that = this; 
		
		return this.#app.db.get()
		.then(function(dbRef) {
			db = dbRef;
			return db.query(that.#app.views.getViewDocId() + '/toc');
		})
		.then(function(data) {
			// For debugging
			if (data.rows.length > 0) {
				console.log(' -> TOC Loader: ' + Tools.convertFilesize(JSON.stringify(data).length) + ' loaded in ' + data.rows.length + ' documents');
			}

			// Set new data in a new data container
			that.#app.setData(new Data(data.rows ? data.rows : [], 'value'));
			
			// Execute callbacks
			that.#app.callbacks.executeCallbacks('requestTree');
			
			// (Re)load tree
			that.#app.nav.destroy();
			
			return that.#app.nav.init();
		})
		.then(function() {
			return Promise.resolve({
				ok: true
			});
		})
		.catch(function(err) {
			if (err.status == 404) {
				// Use fallback method (slow)
				return that.requestTreeFallback();
			}
			
			return Promise.reject(err);
		});
	}
	
	/**
	 * Fallback for requestTree in case the TOC views are missing.
	 */
	requestTreeFallback() {
		var that = this;
		
		return this.#app.db.get()
		.then(function(db) {
			return db.allDocs({
				conflicts: true,
				include_docs: true
			});
		})
		.then(function(data) {
			// For debugging
			console.log(' -> TOC Loader: Views not found, using fallback: ' + Tools.convertFilesize(JSON.stringify(data.rows).length) + ' loaded in ' + data.rows.length + ' documents');
			
			// Set new data in a new data container
			that.#app.setData(new Data(data.rows ? data.rows : [], 'doc'));
			
			// Execute callbacks
			that.#app.callbacks.executeCallbacks('requestTree');

			// (Re)load tree
			that.#app.nav.destroy();
			
			return that.#app.nav.init();
		})
		.then(function() {
			return Promise.resolve({
				fallback: true,
				ok: true
			});
		});
	}
}