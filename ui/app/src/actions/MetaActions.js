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
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!MetaActions.instance) MetaActions.instance = new MetaActions();
		return MetaActions.instance;
	}
	
	static metaDocId = 'global-meta';

	constructor() {
		this.meta = {};
	}
	
	/**
	 * Request the global metadata. After this is done, the meta data is accessible
	 * in the meta attribute.
	 */
	requestGlobalMeta() {
		var that = this;
		
		return Database.getInstance().get()
		.then(function(db) {
			return db.get(MetaActions.metaDocId);
		})
		.then(function (data) {
			// Execute callbacks
			Callbacks.getInstance().executeCallbacks('requestGlobalMeta', data);
    		
			if (data && data.meta) {
				that.meta = data.meta;	
				//console.log(' -> Loaded global metadata');

				return Promise.resolve({ 
					ok: true
				});
			}
			return Promise.resolve({ 
				ok: false
			});
		})
		.catch(function(err) {
			// Not found: This is no severe error in this case, so we resolve the promise instead of rejecting.
			if (err.status == 404) {
				console.log(' -> No global metadata document exists yet');
				return Promise.resolve({ 
					ok: false,
					message: err.message,
					messageThreadId: 'RequestMetaMessages'
				});
			}
			
			return Promise.reject({
				message: err.message,
				messageThreadId: 'RequestMetaMessages'
			});
		});
	}
	
	/**
	 * Saves the meta data to database.
	 */
	saveGlobalMeta() {
		var that = this;
		var db;
		var metadoc;
		
		return Database.getInstance().get()
		.then(function(_db) {
			db = _db;
			return db.get(MetaActions.metaDocId)
			.then(function(data) {
				metadoc = data;
				return Promise.resolve();
			})
			.catch(function(err) {
				if (!err) return Promise.reject();
				if (err.status == 404) {
					metadoc = {
						_id: MetaActions.metaDocId,
					}
					return Promise.resolve();
				}
				return Promise.reject();
			})
		})
		.then(function() {
			if (!metadoc) {
				throw new Error('No meta document created');
			} 

			metadoc.meta = that.meta;
			metadoc.timestamp = Date.now();
			
			return db.put(metadoc, {
				force: true
			});
		})
		.then(function (data) {
			if (!data.ok) {
				return Promise.reject({
					message: data.message,
					messageThreadId: 'SaveMetaMessages'
				});
			}
			
			console.log(' -> Saved global metadata');
			
			// Execute callbacks
			Callbacks.getInstance().executeCallbacks('saveGlobalMeta', metadoc);
    		
			return Promise.resolve({
				message: "Saved global metadata.",
				messageThreadId: 'SaveMetaMessages'
			});
		})
	}
}