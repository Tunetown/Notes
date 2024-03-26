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
	
	constructor(app) {
		this.#app = app;
	}
	
	/**
	 * Request the note tree, and set the tree view accordingly.
	 */
	async requestTree() {
		var db = await this.#app.db.get();
		
		try {
			var data = await db.query(this.#app.views.getViewDocId() + '/toc');
	
			// For debugging
			if (data.rows.length > 0) {
				console.log(' -> TOC Loader: ' + Tools.convertFilesize(JSON.stringify(data).length) + ' loaded in ' + data.rows.length + ' documents');
			}
	
			// Set new data in a new data container
			this.#app.setData(new Data(this.#app, data.rows ? data.rows : [], 'value'));
			
			// Execute callbacks
			this.#app.callbacks.executeCallbacks('requestTree');
			
			// (Re)load tree
			this.#app.nav.destroy();
				
			await this.#app.nav.init();
				
			return { ok: true };
			
		} catch(err) {
			if (err.status == 404) {
				// Use fallback method (slow)
				return await this.requestTreeFallback();
			}
			
			throw err;
		}
	}
	
	/**
	 * Fallback for requestTree in case the TOC views are missing.
	 */
	async requestTreeFallback() {
		var db = await this.#app.db.get();
		
		var data = await db.allDocs({
			conflicts: true,
			include_docs: true
		});

		// For debugging
		console.log(' -> TOC Loader: Views not found, using fallback: ' + Tools.convertFilesize(JSON.stringify(data.rows).length) + ' loaded in ' + data.rows.length + ' documents');
		
		// Set new data in a new data container
		this.#app.setData(new Data(data.rows ? data.rows : [], 'doc'));
		
		// Execute callbacks
		this.#app.callbacks.executeCallbacks('requestTree');

		// (Re)load tree
		this.#app.nav.destroy();
		
		await this.#app.nav.init();

		return {
			fallback: true,
			ok: true
		};
	}
}