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
class TreeActions {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!TreeActions.instance) TreeActions.instance = new TreeActions();
		return TreeActions.instance;
	}
	
	/**
	 * Request the note tree, and set the tree view accordingly.
	 */
	requestTree() {
		var db;
		var that = this; 
		
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			return db.query(Views.getInstance().getViewDocId() + '/toc');
		})
		.then(function (data) {
			// For debugging
			if (data.rows.length > 0) {
				console.log(' -> TOC Loader: ' + Tools.convertFilesize(JSON.stringify(data).length) + ' loaded in ' + data.rows.length + ' documents');
			}

			// Set new data in a new data container
			Notes.getInstance().setData(new Data(data.rows ? data.rows : [], 'value'));
			
			// Execute callbacks
			Callbacks.getInstance().executeCallbacks('requestTree');
			
			return Promise.resolve({
				ok: true
			});
		})
		.catch(function(err) {
			if (err.status == 404) {
				// Use fallback method (slow)
				return that.requestTreeFallback();
			}
		});
	}
	
	/**
	 * Fallback for requestTree in case the TOC views are missing.
	 */
	requestTreeFallback() {
		return Database.getInstance().get()
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
			Notes.getInstance().setData(new Data(data.rows ? data.rows : [], 'doc'));
			
			// Execute callbacks
			Callbacks.getInstance().executeCallbacks('requestTree');

			return Promise.resolve({
				fallback: true,
				ok: true
			});
		});
	}
}