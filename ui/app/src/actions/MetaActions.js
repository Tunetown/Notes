/**
 * Actions for global metadata, stored in a separate document.
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
class MetaActions {
	
	static metaDocId = 'global-meta';      // #IGNORE static 

	#app = null;

	#lock = false;
		
	constructor(app) {
		this.#app = app;

		this.meta = {};
	}
	
	/**
	 * Request the global metadata. After this is done, the meta data is accessible
	 * in the meta attribute.
	 */
	async requestGlobalMeta() {
		var db = await this.#app.db.get();
		
		try {
			var data = await db.get(MetaActions.metaDocId);
	
			// Execute callbacks
			this.#app.callbacks.executeCallbacks('requestGlobalMeta', data);
	    		
			if (!data || !data.meta) {
				return {  ok: false };
			}

			this.meta = data.meta;	
			console.log(' -> Loaded global metadata');  // TODO remove again

			return {  ok: true };

		} catch(err) {
			// Not found: This is no severe error in this case, so we resolve the promise instead of rejecting.
			if (err.status == 404) {
				console.log(' -> No global metadata document exists yet');
				
				return { 
					ok: false,
					message: err.message
				};
			}
			
			throw err;
		}
	}
	
	/**
	 * Saves the meta data to database.
	 */
	async saveGlobalMeta() {
		if (this.#lock) throw new Error('Meta data is locked');
		this.#lock = true;
		
		var db = await this.#app.db.get();

		var metadoc;
		try {
			metadoc = await db.get(MetaActions.metaDocId);
		} catch (err) {
			if (err.status == 404) {
				metadoc = {
					_id: MetaActions.metaDocId,
				}
			} else {
				this.#lock = false;
				throw err;
			}
		}

		if (!metadoc) {
			this.#lock = false;
			throw new Error('No meta document created');
		} 

		var rev = metadoc._rev;
		metadoc.meta = this.meta;
		metadoc.timestamp = Date.now();
		metadoc._rev = rev;
		
		var resp = await db.put(metadoc, {
			force: true
		});
			
		this.#lock = false;
			
		if (!resp.ok) throw new Error(data.message);
			
		console.log(' -> Saved global metadata');
			
		// Execute callbacks
		this.#app.callbacks.executeCallbacks('saveGlobalMeta', metadoc);
    		
		return {
			ok: true,
			message: "Saved global metadata."
		}
	}
}