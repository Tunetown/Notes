/**
 * Actions for global metadata.
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
	
	constructor() {
		this.metaDocName = 'global-meta';
		this.meta = {};
	}
	
	/**
	 * Request the global metadata.
	 */
	requestGlobalMeta() {
		var that = this;
		this.meta = {};
		
		return Database.getInstance().get()
		.then(function(db) {
			return db.get(this.metaDocName);
		})
		.then(function (data) {
			// Execute callbacks
			Callbacks.getInstance().executeCallbacks('requestGlobalMeta', data);
    		
			that.meta = data;

			return Promise.resolve({ 
				ok: true,
				data: data
			});
		})
		.catch(function(err) {
			// Not found: This is no severe error in this case, so we resolve the promise instead of rejecting.
			if (err.status == 404) return Promise.resolve({ 
				ok: false,
				data: {},
				message: err.message,
				messageThreadId: 'RequestMetaMessages'
			});
			
			return Promise.reject({
				message: err.message,
				messageThreadId: 'RequestMetaMessages'
			});
		});
	}
	
	/**
	 * Request the settings for the user
	 */
	saveGlobalMeta() {
		var that = this;
		
		var doc;
		return Database.getInstance().get()
		.then(function(db) {
			doc = that.meta;
			doc._id = that.metaDocName;
			
			return db.put(doc);
		})
		.then(function (data) {
			if (!data.ok) {
				return Promise.reject({
					message: data.message,
					messageThreadId: 'SaveMetaMessages'
				});
			}
			
			// Execute callbacks
			Callbacks.getInstance().executeCallbacks('saveGlobalMeta', doc);
    		
			return Promise.resolve({
				message: "Saved global metadata.",
				messageThreadId: 'SaveMetaMessages'
			});
		})
		.catch(function(err) {
			return Promise.reject(err);
		});
	}
}