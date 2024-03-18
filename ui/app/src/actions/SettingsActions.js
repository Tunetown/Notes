/**
 * Actions for settings.
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
class SettingsActions {
	
	#app = null;
	#documentAccess = null;
	
	constructor(app, documentAccess) {
		this.#app = app;
		this.#documentAccess = documentAccess;
	}
	
	/**
	 * Request the settings for the user
	 */
	requestSettings() {
		var that = this;
		
		return this.#app.db.get()
		.then(function(db) {
			return db.get(Settings.settingsDocId);
		})
		.then(function (data) {
			that.#app.settings.set(data);
			
			// Execute callbacks
			that.#app.callbacks.executeCallbacks('requestSettings', data);
    		
			return Promise.resolve({ ok: true });
		})
		.catch(function(err) {
			// Not found: This is no severe error in this case, so we resolve the promise instead of rejecting.
			if (err.status == 404) return Promise.resolve({ 
				ok: false,
				message: err.message,
				messageThreadId: 'RequestSettingsMessages'
			});
			
			return Promise.reject({
				message: err.message,
				messageThreadId: 'RequestSettingsMessages'
			});
		});
	}
	
	/**
	 * Request the settings for the user
	 */
	saveSettings() {
		var that = this;
		
		var db;
		var doc;
		
		return this.#app.db.get()
		.then(function(_db) {
			db = _db;
			return db.get(Settings.settingsDocId);
		})
		.then(function (oldDoc) {
			doc = that.#app.settings.get();
			doc._id = Settings.settingsDocId;
			doc._rev = oldDoc._rev;
			
			return db.put(doc);
		})
		.then(function (data) {
			if (!data.ok) {
				return Promise.reject({
					message: data.message,
					messageThreadId: 'SaveSettingsMessages'
				});
			}
			
			return that.requestSettings();
		})
		.then(function (/*data*/) {
			// Execute callbacks
			that.#app.callbacks.executeCallbacks('saveSettings', doc);
    		
			return Promise.resolve({
				message: "Saved settings.",
				messageThreadId: 'SaveSettingsMessages'
			});
		})
		.catch(function(err) {
			return Promise.reject(err);
		});
	}
	
	/**
	 * Check settings consistency
	 */
	checkSettings() {
		var that = this;
		
		return this.#app.db.get()
		.then(function(db) {
			return db.get(Settings.settingsDocId);
		})
		.then(function (data) {
			var errors = [];
			var ret = that.#app.settings.checkSettings(data, errors);
			return Promise.resolve({
				propertiesChecked: ret.numPropsChecked,
				errors: errors,
				ok: ret.ok
			});
		})
		.then(function(data) {
			return that.#app.db.checkConflicts(Settings.settingsDocId)
			.then(function(data2) {
				var resp = Tools.mergeCheckResponses([data, data2]);
				resp.numChecked = 1;
				return Promise.resolve(resp);
			})
			.catch(function(data2) {
				var resp = Tools.mergeCheckResponses([data, data2]);
				resp.numChecked = 1;
				return Promise.reject(resp);
			});
		});
	}
}