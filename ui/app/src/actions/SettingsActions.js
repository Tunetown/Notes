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
	
	static settingsDocId = 'settings';     // #IGNORE static 

	#app = null;
	
	constructor(app) {
		this.#app = app;
	}
	
	/**
	 * Request the settings for the user
	 */
	async requestSettings() {
		var db = await this.#app.db.get();
		
		try {
			var data = await db.get(SettingsActions.settingsDocId);
	
			this.#app.settings.set(data);
				
			// Execute callbacks
			this.#app.callbacks.executeCallbacks('requestSettings', data);
	    		
			return Promise.resolve({ ok: true });
		
		} catch(err) {
			// Not found: This is no severe error in this case, so we resolve the promise instead of rejecting.
			if (err.status == 404) return { 
				ok: false,
				message: err.message
			};
			
			throw err;
		}
	}
	
	/**
	 * Request the settings for the user
	 */
	async saveSettings() {
		var db = await this.#app.db.get();
		var oldDoc = await db.get(SettingsActions.settingsDocId);

		var doc = this.#app.settings.settings;
		doc._id = Settings.settingsDocId;
		doc._rev = oldDoc._rev;
			
		var resp = await db.put(doc);
		if (!resp.ok) throw new Error(resp.message);
			
		await this.requestSettings();

		// Execute callbacks
		this.#app.callbacks.executeCallbacks('saveSettings', doc);
    		
		return {
			message: "Saved settings."
		};
	}
	
	/**
	 * Check settings consistency
	 */
	async checkSettings() {
		var db = await this.#app.db.get();
		
			var settingsDoc = await db.get(SettingsActions.settingsDocId);

		var errors = [];
		var ret = this.#app.settings.checkSettings(settingsDoc, errors);
			
		var data = {
			propertiesChecked: ret.numPropsChecked,
			errors: errors,
			ok: ret.ok
		};
	
		try {
			var data2 = await this.#app.db.checkConflicts(SettingsActions.settingsDocId);
					
			var resp = Tools.mergeCheckResponses([data, data2]);
			resp.numChecked = 1;
			
			return resp;
			
		} catch(data2) {
			var resp = Tools.mergeCheckResponses([data, data2]);
			resp.numChecked = 1;
			throw resp;
		}
	}
}